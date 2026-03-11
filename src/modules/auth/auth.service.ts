import {
  Injectable, BadRequestException, UnauthorizedException,
  ConflictException, NotFoundException, ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as admin from 'firebase-admin';
import { Inject } from '@nestjs/common';
import { RedisService } from '../../shared/redis/redis.service';
import { MailService } from '../../shared/mail/mail.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@Injectable()
export class AuthService {
  private db: admin.firestore.Firestore;

  constructor(
    @Inject('FIREBASE_ADMIN') private firebaseApp: admin.app.App,
    private jwtService: JwtService,
    private redisService: RedisService,
    private mailService: MailService,
    private config: ConfigService,
  ) {
    this.db = firebaseApp.firestore();
  }

  // ─── HELPERS ──────────────────────────────────────────────────────────────

  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /** Tạo cặp accessToken + refreshToken */
  private generateTokens(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.config.get('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get('JWT_ACCESS_EXPIRES'), // 15m
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.config.get('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get('JWT_REFRESH_EXPIRES'), // 7d
    });

    return { accessToken, refreshToken };
  }

  /** Lưu refresh token vào Redis (TTL = 7 ngày) */
  private async saveRefreshToken(userId: string, refreshToken: string) {
    const ttl = 7 * 24 * 60 * 60; // 7 ngày tính bằng giây
    await this.redisService.setRefreshToken(userId, refreshToken, ttl);
  }

  // ─── REGISTER ─────────────────────────────────────────────────────────────

  async register(dto: RegisterDto) {
    const existing = await this.db.collection('users')
      .where('email', '==', dto.email).limit(1).get();

    if (!existing.empty) {
      throw new ConflictException('Email đã được sử dụng');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const userRef = this.db.collection('users').doc();
    await userRef.set({
      id: userRef.id,
      name: dto.name,
      email: dto.email,
      password: hashedPassword,
      role: 'buyer',          // ✅ Mặc định buyer
      isVerified: false,
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const otp = this.generateOtp();
    await this.redisService.setOtp(dto.email, otp, 300);
    await this.mailService.sendOtpEmail(dto.email, otp, 'register');

    return { message: 'Đăng ký thành công! Vui lòng kiểm tra email để lấy OTP.' };
  }

  // ─── VERIFY OTP ───────────────────────────────────────────────────────────

  async verifyOtp(dto: VerifyOtpDto) {
    const storedOtp = await this.redisService.getOtp(dto.email);

    if (!storedOtp) {
      throw new BadRequestException('OTP đã hết hạn. Vui lòng yêu cầu OTP mới.');
    }
    if (storedOtp !== dto.otp) {
      throw new BadRequestException('OTP không đúng.');
    }

    await this.redisService.deleteOtp(dto.email);

    if (dto.type === 'register') {
      const snapshot = await this.db.collection('users')
        .where('email', '==', dto.email).limit(1).get();

      if (snapshot.empty) throw new NotFoundException('Tài khoản không tồn tại');

      const userDoc = snapshot.docs[0];
      await userDoc.ref.update({ isVerified: true });
      const user = userDoc.data();

      // ✅ Trả về cả 2 tokens sau khi verify
      const tokens = this.generateTokens(userDoc.id, user.email, user.role);
      await this.saveRefreshToken(userDoc.id, tokens.refreshToken);

      return {
        message: 'Xác thực thành công!',
        ...tokens,
        user: { id: userDoc.id, name: user.name, email: user.email, role: user.role },
      };
    }

    return { message: 'OTP hợp lệ. Hãy tiến hành đặt lại mật khẩu.' };
  }

  // ─── LOGIN ────────────────────────────────────────────────────────────────

  async login(dto: LoginDto) {
    const snapshot = await this.db.collection('users')
      .where('email', '==', dto.email).limit(1).get();

    if (snapshot.empty) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    const userDoc = snapshot.docs[0];
    const user = userDoc.data();

    if (!user.isVerified) {
      throw new UnauthorizedException('Tài khoản chưa được xác thực. Vui lòng kiểm tra email.');
    }
    if (!user.isActive) {
      throw new ForbiddenException('Tài khoản đã bị khoá.');
    }

    const isMatch = await bcrypt.compare(dto.password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    // ✅ Tạo cả 2 tokens
    const tokens = this.generateTokens(userDoc.id, user.email, user.role);
    await this.saveRefreshToken(userDoc.id, tokens.refreshToken);

    return {
      message: 'Đăng nhập thành công!',
      ...tokens,
      user: { id: userDoc.id, name: user.name, email: user.email, role: user.role },
    };
  }


  async refreshToken(dto: RefreshTokenDto) {
    let payload: any;
    try {
      payload = this.jwtService.verify(dto.refreshToken, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token không hợp lệ hoặc đã hết hạn.');
    }

    const userId = payload.sub;

    const storedToken = await this.redisService.getRefreshToken(userId);
    if (!storedToken || storedToken !== dto.refreshToken) {
      throw new UnauthorizedException('Refresh token đã bị thu hồi. Vui lòng đăng nhập lại.');
    }

    const userDoc = await this.db.collection('users').doc(userId).get();
    if (!userDoc.exists) throw new NotFoundException('Tài khoản không tồn tại');

    const user = userDoc.data();
    if (!user) throw new NotFoundException('Không lấy được dữ liệu tài khoản');

    const tokens = this.generateTokens(userId, user.email, user.role);
    await this.saveRefreshToken(userId, tokens.refreshToken); 

    return {
      message: 'Làm mới token thành công!',
      ...tokens,
    };
  }


  async logout(userId: string) {
    await this.redisService.deleteRefreshToken(userId);
    return { message: 'Đăng xuất thành công!' };
  }


  async forgotPassword(dto: ForgotPasswordDto) {
    const snapshot = await this.db.collection('users')
      .where('email', '==', dto.email).limit(1).get();

    if (!snapshot.empty) {
      const otp = this.generateOtp();
      await this.redisService.setOtp(dto.email, otp, 300);
      await this.mailService.sendOtpEmail(dto.email, otp, 'reset');
    }

    return { message: 'OTP đã được gửi.' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const storedOtp = await this.redisService.getOtp(dto.email);

    if (!storedOtp) {
      throw new BadRequestException('OTP đã hết hạn. Vui lòng yêu cầu OTP mới.');
    }
    if (storedOtp !== dto.otp) {
      throw new BadRequestException('OTP không đúng.');
    }

    const snapshot = await this.db.collection('users')
      .where('email', '==', dto.email).limit(1).get();

    if (snapshot.empty) throw new NotFoundException('Tài khoản không tồn tại');

    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);
    const userDoc = snapshot.docs[0];

    await userDoc.ref.update({ password: hashedPassword });
    await this.redisService.deleteOtp(dto.email);
    await this.redisService.deleteRefreshToken(userDoc.id);

    return { message: 'Đặt lại mật khẩu thành công! Hãy đăng nhập lại.' };
  }

  async resendOtp(dto: ResendOtpDto) {
    const limited = await this.redisService.getResendLimit(dto.email);
    if (limited) {
      throw new BadRequestException('Vui lòng chờ 1 phút trước khi gửi lại OTP.');
    }

    const otp = this.generateOtp();
    await this.redisService.setOtp(dto.email, otp, 300);
    await this.redisService.setResendLimit(dto.email, 60);
    await this.mailService.sendOtpEmail(dto.email, otp, dto.type);

    return { message: 'OTP mới đã được gửi vào email của bạn.' };
  }
}
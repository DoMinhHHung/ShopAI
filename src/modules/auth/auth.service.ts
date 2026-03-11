import {
  Injectable, BadRequestException, UnauthorizedException,
  ConflictException, NotFoundException,
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

  // ─── HELPER ───────────────────────────────────────────
  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private generateJwt(userId: string, email: string, role: string) {
    return this.jwtService.sign(
      { sub: userId, email, role },
      {
        secret: this.config.get('JWT_SECRET'),
        expiresIn: this.config.get('JWT_EXPIRES_IN'),
      },
    );
  }

  // ─── REGISTER ─────────────────────────────────────────
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
      role: dto.role,
      isVerified: false,
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const otp = this.generateOtp();
    await this.redisService.setOtp(dto.email, otp, 300);

    await this.mailService.sendOtpEmail(dto.email, otp, 'register');

    return {
      message: 'Đăng ký thành công! Vui lòng kiểm tra email để lấy OTP.',
    };
  }

  // ─── VERIFY OTP ───────────────────────────────────────
  async verifyOtp(dto: VerifyOtpDto) {
    const storedOtp = await this.redisService.getOtp(dto.email);

    if (!storedOtp) {
      throw new BadRequestException('OTP đã hết hạn. Vui lòng yêu cầu OTP mới.');
    }
    if (storedOtp !== dto.otp) {
      throw new BadRequestException('OTP không đúng.');
    }

    // Xoá OTP sau khi dùng
    await this.redisService.deleteOtp(dto.email);

    if (dto.type === 'register') {
      // Kích hoạt tài khoản
      const snapshot = await this.db.collection('users')
        .where('email', '==', dto.email).limit(1).get();

      if (snapshot.empty) throw new NotFoundException('Tài khoản không tồn tại');

      const userDoc = snapshot.docs[0];
      await userDoc.ref.update({ isVerified: true });
      const user = userDoc.data();

      const token = this.generateJwt(userDoc.id, user.email, user.role);
      return {
        message: 'Xác thực thành công!',
        accessToken: token,
        user: { id: userDoc.id, name: user.name, email: user.email, role: user.role },
      };
    }

    // type === 'reset' → chỉ xác nhận OTP, chưa đổi pass
    return { message: 'OTP hợp lệ. Hãy tiến hành đặt lại mật khẩu.' };
  }

  // ─── LOGIN ────────────────────────────────────────────
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

    const isMatch = await bcrypt.compare(dto.password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    const token = this.generateJwt(userDoc.id, user.email, user.role);
    return {
      message: 'Đăng nhập thành công!',
      accessToken: token,
      user: { id: userDoc.id, name: user.name, email: user.email, role: user.role },
    };
  }

  // ─── FORGOT PASSWORD ──────────────────────────────────
  async forgotPassword(dto: ForgotPasswordDto) {
    const snapshot = await this.db.collection('users')
      .where('email', '==', dto.email).limit(1).get();

    if (snapshot.empty) {
      return { message: 'Nếu email tồn tại, OTP đã được gửi.' };
    }

    const otp = this.generateOtp();
    await this.redisService.setOtp(dto.email, otp, 300);
    await this.mailService.sendOtpEmail(dto.email, otp, 'reset');

    return { message: 'Nếu email tồn tại, OTP đã được gửi.' };
  }

  // ─── RESET PASSWORD ───────────────────────────────────
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
    await snapshot.docs[0].ref.update({ password: hashedPassword });

    await this.redisService.deleteOtp(dto.email);

    return { message: 'Đặt lại mật khẩu thành công! Hãy đăng nhập lại.' };
  }

  // ─── RESEND OTP ───────────────────────────────────────
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
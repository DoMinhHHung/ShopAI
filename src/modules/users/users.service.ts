import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import * as admin from 'firebase-admin';
import * as bcrypt from 'bcryptjs';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { RedisService } from '../../shared/redis/redis.service';

@Injectable()
export class UsersService {
  private db: admin.firestore.Firestore;

  constructor(
    @Inject('FIREBASE_ADMIN') private firebaseApp: admin.app.App,
    private redisService: RedisService,
  ) {
    this.db = firebaseApp.firestore();
  }

  // ─── HELPER: lấy user doc hoặc throw ────────────────────────────────────
  private async getUserDoc(userId: string) {
    const doc = await this.db.collection('users').doc(userId).get();
    if (!doc.exists) throw new NotFoundException('Tài khoản không tồn tại');
    const data = doc.data();
    if (!data) throw new NotFoundException('Không lấy được dữ liệu tài khoản');
    return { doc, data };
  }

  // ─── GET PROFILE ─────────────────────────────────────────────────────────
  async getProfile(userId: string) {
    const { data } = await this.getUserDoc(userId);

    // ✅ Trả về thông tin cá nhân, loại bỏ password + role
    return {
      id: userId,
      name: data.name,
      email: data.email,
      phone: data.phone ?? null,
      address: data.address ?? null,
      avatar: data.avatar ?? null,
      isVerified: data.isVerified,
      createdAt: data.createdAt,
    };
  }

  // ─── UPDATE PROFILE ───────────────────────────────────────────────────────
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const { doc } = await this.getUserDoc(userId);

    // Chỉ update các field được gửi lên (loại bỏ undefined)
    const updateData: Record<string, any> = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.phone !== undefined) updateData.phone = dto.phone;
    if (dto.address !== undefined) updateData.address = dto.address;

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException('Không có thông tin nào để cập nhật');
    }

    updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    await doc.ref.update(updateData);

    return { message: 'Cập nhật thông tin thành công!' };
  }

  // ─── CHANGE PASSWORD ──────────────────────────────────────────────────────
  async changePassword(userId: string, dto: ChangePasswordDto) {
    const { doc, data } = await this.getUserDoc(userId);

    // 1. Kiểm tra mật khẩu hiện tại
    const isMatch = await bcrypt.compare(dto.currentPassword, data.password);
    if (!isMatch) {
      throw new BadRequestException('Mật khẩu hiện tại không đúng');
    }

    // 2. Không cho đặt trùng mật khẩu cũ
    const isSame = await bcrypt.compare(dto.newPassword, data.password);
    if (isSame) {
      throw new BadRequestException('Mật khẩu mới không được trùng mật khẩu cũ');
    }

    // 3. Hash & update
    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);
    await doc.ref.update({
      password: hashedPassword,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 4. Force logout — xoá refresh token
    await this.redisService.deleteRefreshToken(userId);

    return { message: 'Đổi mật khẩu thành công! Vui lòng đăng nhập lại.' };
  }

  // ─── DELETE ACCOUNT ───────────────────────────────────────────────────────
  async deleteAccount(userId: string, password: string) {
    const { doc, data } = await this.getUserDoc(userId);

    // Xác nhận mật khẩu trước khi xoá
    const isMatch = await bcrypt.compare(password, data.password);
    if (!isMatch) {
      throw new BadRequestException('Mật khẩu không đúng');
    }

    // Xoá refresh token
    await this.redisService.deleteRefreshToken(userId);

    // Soft delete — giữ data nhưng deactivate
    await doc.ref.update({
      isActive: false,
      deletedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { message: 'Tài khoản đã được xoá thành công.' };
  }

  // ─── BECOME SELLER (chuyển từ Auth) ──────────────────────────────────────
  async becomeSeller(userId: string) {
    const { doc, data } = await this.getUserDoc(userId);

    if (data.role === 'seller') {
      throw new BadRequestException('Bạn đã là seller rồi!');
    }

    await doc.ref.update({
      role: 'seller',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Force re-login để JWT mới có role = 'seller'
    await this.redisService.deleteRefreshToken(userId);

    return {
      message: 'Đăng ký seller thành công! Vui lòng đăng nhập lại để cập nhật quyền.',
    };
  }
}
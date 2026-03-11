import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class MailService {
  constructor(private mailer: MailerService) {}

  async sendOtpEmail(email: string, otp: string, type: 'register' | 'reset'): Promise<void> {
    const subject = type === 'register'
      ? '🛍️ ShopAI — Xác thực tài khoản'
      : '🔐 ShopAI — Đặt lại mật khẩu';

    await this.mailer.sendMail({
      to: email,
      subject,
      template: 'otp',
   context: {
  otp,
  expireMinutes: 5,
  isRegister: type === 'register',
}
    });
  }
}
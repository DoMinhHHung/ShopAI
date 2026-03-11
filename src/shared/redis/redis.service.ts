import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private client: Redis;

  constructor(private config: ConfigService) {
    this.client = new Redis({
      host: this.config.get('REDIS_HOST'),
      port: this.config.get<number>('REDIS_PORT'),
    });

    this.client.on('connect', () => console.log('✅ Redis connected'));
    this.client.on('error', (err) => console.error('❌ Redis error:', err));
  }

  async setOtp(key: string, otp: string, ttlSeconds: number): Promise<void> {
    await this.client.set(`otp:${key}`, otp, 'EX', ttlSeconds);
  }

  async getOtp(key: string): Promise<string | null> {
    return this.client.get(`otp:${key}`);
  }

  async deleteOtp(key: string): Promise<void> {
    await this.client.del(`otp:${key}`);
  }

  // Kiểm tra rate limit resend OTP
  async setResendLimit(email: string, ttlSeconds: number): Promise<void> {
    await this.client.set(`resend:${email}`, '1', 'EX', ttlSeconds);
  }

  async getResendLimit(email: string): Promise<string | null> {
    return this.client.get(`resend:${email}`);
  }

  async setRefreshToken(userId: string, token: string, ttlSeconds: number) {
    await this.client.set(`refresh:${userId}`, token, 'EX', ttlSeconds);
  }

  async getRefreshToken(userId: string): Promise<string | null> {
    return this.client.get(`refresh:${userId}`);
  }

  async deleteRefreshToken(userId: string): Promise<void> {
    await this.client.del(`refresh:${userId}`);
  }

  onModuleDestroy() {
    this.client.quit();
  }
}
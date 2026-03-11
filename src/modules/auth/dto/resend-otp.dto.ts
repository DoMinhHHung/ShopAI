import { IsEmail, IsString } from 'class-validator';

export class ResendOtpDto {
  @IsEmail()
  email: string;

  @IsString()
  type: 'register' | 'reset';
}
import { IsString, IsOptional, IsPhoneNumber } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Nguyen Van A' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: '0912345678' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: '123 Nguyen Hue, Q1, HCM' })
  @IsString()
  @IsOptional()
  address?: string;
}
import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({ example: 'OldPassword123!' })
  @IsString()
  currentPassword: string;

  @ApiProperty({ example: 'NewPassword456!' })
  @IsString()
  @MinLength(6)
  newPassword: string;
}
import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DeleteAccountDto {
  @ApiProperty({ example: 'YourPassword123!' })
  @IsString()
  password: string;
}
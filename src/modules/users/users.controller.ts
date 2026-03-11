import {
  Controller, Get, Patch, Delete,
  Body, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)  
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Lấy thông tin cá nhân' })
  getProfile(@CurrentUser() user: any) {
    return this.usersService.getProfile(user.userId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Cập nhật thông tin (tên, phone, địa chỉ)' })
  updateProfile(
    @CurrentUser() user: any,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(user.userId, dto);
  }

  @Patch('me/change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đổi mật khẩu' })
  changePassword(
    @CurrentUser() user: any,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.usersService.changePassword(user.userId, dto);
  }

  @Delete('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xoá tài khoản (cần xác nhận mật khẩu)' })
  deleteAccount(
    @CurrentUser() user: any,
    @Body() dto: DeleteAccountDto,
  ) {
    return this.usersService.deleteAccount(user.userId, dto.password);
  }

  @Patch('me/become-seller')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đăng ký trở thành Seller' })
  becomeSeller(@CurrentUser() user: any) {
    return this.usersService.becomeSeller(user.userId);
  }
}
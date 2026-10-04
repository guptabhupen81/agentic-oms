import { Body, Controller, Post } from '@nestjs/common';
import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { UserRole } from '@prisma/client';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';
import { Roles } from './roles.decorator';

class LoginDto {
  /** Distributor code (DB_ADMIN), "MDM_Admin" (MDM admin), or an email for legacy/mobile logins. */
  @IsString()
  @IsNotEmpty()
  loginId: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  loginId: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsIn(['MDM_ADMIN', 'DB_ADMIN', 'ADMIN', 'OMS_EXECUTIVE', 'PRESELLER', 'WAREHOUSE_INCHARGE', 'VAN_SELLER'])
  role: string;

  @IsOptional()
  @IsString()
  distributorId?: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.loginId, dto.password);
  }

  /** No longer open: only MDM_ADMIN can create users. The first MDM_Admin comes
   * from seeding (prisma/seed.ts or the SQL script). */
  @Roles(UserRole.MDM_ADMIN)
  @Post('users')
  createUser(@Body() dto: CreateUserDto) {
    return this.authService.createUser(dto);
  }
}

import { Body, Controller, Post } from '@nestjs/common';
import { IsEmail, IsIn, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';

class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsIn(['ADMIN', 'OMS_EXECUTIVE', 'PRESELLER', 'WAREHOUSE_INCHARGE', 'VAN_SELLER'])
  role: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  // NOTE: open for showcase/demo purposes. In production this must be
  // restricted to ADMIN (e.g. @Roles(UserRole.ADMIN) once at least one admin
  // account exists via seeding).
  @Public()
  @Post('users')
  createUser(@Body() dto: CreateUserDto) {
    return this.authService.createUser(dto.name, dto.email, dto.password, dto.role);
  }
}

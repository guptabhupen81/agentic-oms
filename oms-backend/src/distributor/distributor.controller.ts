import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { DistributorService, DistributorInput } from './distributor.service';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';

@Controller('distributors')
export class DistributorController {
  constructor(private readonly distributorService: DistributorService) {}

  @Roles(UserRole.MDM_ADMIN)
  @Get()
  list() {
    return this.distributorService.list();
  }

  /** The DB Admin's own distributor (for the header / profile). Declared before ':id'. */
  @Roles(UserRole.DB_ADMIN)
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.distributorService.findById(user.distributorId as string);
  }

  @Roles(UserRole.MDM_ADMIN)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.distributorService.findById(id);
  }

  @Roles(UserRole.MDM_ADMIN)
  @Post()
  create(@Body() body: DistributorInput & { initialPassword: string }) {
    return this.distributorService.create(body);
  }

  @Roles(UserRole.MDM_ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Partial<Omit<DistributorInput, 'code'>>) {
    return this.distributorService.update(id, body);
  }

  @Roles(UserRole.MDM_ADMIN)
  @Post(':id/toggle-active')
  toggleActive(@Param('id') id: string, @Body() body: { isActive: boolean }) {
    return this.distributorService.setActive(id, body.isActive);
  }

  @Roles(UserRole.MDM_ADMIN)
  @Post(':id/reset-password')
  resetPassword(@Param('id') id: string, @Body() body: { newPassword: string }) {
    return this.distributorService.resetPassword(id, body.newPassword);
  }
}

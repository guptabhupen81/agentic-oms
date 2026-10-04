import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { VanMasterService, VanInput } from './van-master.service';
import { Roles } from '../auth/roles.decorator';
import { DISTRIBUTOR_SIDE_ROLES } from '../auth/roles.constants';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { distributorScope } from '../common/scope.util';

@Roles(...DISTRIBUTOR_SIDE_ROLES)
@Controller('vans')
export class VanMasterController {
  constructor(private readonly vanMasterService: VanMasterService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('activeOnly') activeOnly?: string) {
    return this.vanMasterService.list(activeOnly !== 'false', distributorScope(user));
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.vanMasterService.findById(id, distributorScope(user));
  }

  @Roles(UserRole.DB_ADMIN)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: VanInput) {
    return this.vanMasterService.create(body, distributorScope(user));
  }

  @Roles(UserRole.DB_ADMIN)
  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: Partial<VanInput>) {
    return this.vanMasterService.update(id, body, distributorScope(user));
  }

  @Roles(UserRole.DB_ADMIN)
  @Post(':id/toggle-active')
  toggleActive(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { isActive: boolean }) {
    return this.vanMasterService.setActive(id, body.isActive, distributorScope(user));
  }
}

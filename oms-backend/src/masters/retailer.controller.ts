import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { RetailerService, RetailerInput } from './retailer.service';
import { Roles } from '../auth/roles.decorator';
import { DISTRIBUTOR_SIDE_ROLES } from '../auth/roles.constants';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { distributorScope } from '../common/scope.util';

/** Reads: every distributor-side role (scoped to the caller's distributor when a
 * DB_ADMIN). Writes: DB_ADMIN only. */
@Roles(...DISTRIBUTOR_SIDE_ROLES)
@Controller('retailers')
export class RetailerController {
  constructor(private readonly retailerService: RetailerService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('activeOnly') activeOnly?: string) {
    return this.retailerService.list(activeOnly !== 'false', distributorScope(user));
  }

  /** Live PIN code -> City/State preview for the retailer form, before save. */
  @Roles(UserRole.MDM_ADMIN, ...DISTRIBUTOR_SIDE_ROLES)
  @Get('lookup-pincode/:pinCode')
  lookupPincode(@Param('pinCode') pinCode: string) {
    return this.retailerService.lookupPincode(pinCode);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.retailerService.findById(id, distributorScope(user));
  }

  @Roles(UserRole.DB_ADMIN)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: RetailerInput) {
    return this.retailerService.create(body, distributorScope(user));
  }

  @Roles(UserRole.DB_ADMIN)
  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: Partial<RetailerInput>) {
    return this.retailerService.update(id, body, distributorScope(user));
  }

  @Roles(UserRole.DB_ADMIN)
  @Post(':id/toggle-active')
  toggleActive(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { isActive: boolean }) {
    return this.retailerService.setActive(id, body.isActive, distributorScope(user));
  }
}

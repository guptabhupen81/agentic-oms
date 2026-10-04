import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { SalesmanService, SalesmanInput } from './salesman.service';
import { Roles } from '../auth/roles.decorator';
import { DISTRIBUTOR_SIDE_ROLES } from '../auth/roles.constants';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { distributorScope } from '../common/scope.util';

/** Reads: distributor-side roles (scoped). Writes and all mappings: DB_ADMIN only. */
@Roles(...DISTRIBUTOR_SIDE_ROLES)
@Controller('salesmen')
export class SalesmanController {
  constructor(private readonly salesmanService: SalesmanService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('activeOnly') activeOnly?: string) {
    return this.salesmanService.list(activeOnly !== 'false', distributorScope(user));
  }

  @Get('retailer-mappings/:retailerId')
  listMappingsForRetailer(@CurrentUser() user: AuthUser, @Param('retailerId') retailerId: string) {
    return this.salesmanService.listMappingsForRetailer(retailerId, distributorScope(user));
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.salesmanService.findById(id, distributorScope(user));
  }

  @Roles(UserRole.DB_ADMIN)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: SalesmanInput) {
    return this.salesmanService.create(body, distributorScope(user));
  }

  @Roles(UserRole.DB_ADMIN)
  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: Partial<SalesmanInput>) {
    return this.salesmanService.update(id, body, distributorScope(user));
  }

  @Roles(UserRole.DB_ADMIN)
  @Post(':id/toggle-active')
  toggleActive(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { isActive: boolean }) {
    return this.salesmanService.setActive(id, body.isActive, distributorScope(user));
  }

  // --- Retailer mapping ---

  @Roles(UserRole.DB_ADMIN)
  @Post('retailer-mappings')
  mapToRetailer(@CurrentUser() user: AuthUser, @Body() body: { retailerId: string; salesmanId: string }) {
    return this.salesmanService.mapToRetailer(body.retailerId, body.salesmanId, distributorScope(user));
  }

  @Roles(UserRole.DB_ADMIN)
  @Delete('retailer-mappings/:mappingId')
  unmapFromRetailer(@CurrentUser() user: AuthUser, @Param('mappingId') mappingId: string) {
    return this.salesmanService.unmapFromRetailer(mappingId, distributorScope(user));
  }

  // --- Van mapping ---

  @Roles(UserRole.DB_ADMIN)
  @Post(':id/assign-van')
  assignVan(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { vanId: string }) {
    return this.salesmanService.assignVan(id, body.vanId, distributorScope(user));
  }

  @Roles(UserRole.DB_ADMIN)
  @Post(':id/unassign-van')
  unassignVan(@CurrentUser() user: AuthUser, @Body() body: { vanId: string }) {
    return this.salesmanService.unassignVan(body.vanId, distributorScope(user));
  }
}

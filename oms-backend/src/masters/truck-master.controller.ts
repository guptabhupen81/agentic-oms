import { UserRole } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { TruckMasterService, TruckInput } from './truck-master.service';

@Controller('trucks')
export class TruckMasterController {
  constructor(private readonly truckMasterService: TruckMasterService) {}

  @Get()
  list(@Query('activeOnly') activeOnly?: string) {
    return this.truckMasterService.list(activeOnly !== 'false');
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.truckMasterService.findById(id);
  }

  @Roles(UserRole.MDM_ADMIN)
  @Post()
  create(@Body() body: TruckInput) {
    return this.truckMasterService.create(body);
  }

  @Roles(UserRole.MDM_ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Partial<TruckInput>) {
    return this.truckMasterService.update(id, body);
  }

  @Roles(UserRole.MDM_ADMIN)
  @Post(':id/toggle-active')
  toggleActive(@Param('id') id: string, @Body() body: { isActive: boolean }) {
    return this.truckMasterService.setActive(id, body.isActive);
  }
}

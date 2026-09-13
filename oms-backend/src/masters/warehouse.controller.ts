import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { WarehouseService, WarehouseInput } from './warehouse.service';

@Controller('warehouses')
export class WarehouseController {
  constructor(private readonly warehouseService: WarehouseService) {}

  @Get()
  list(@Query('activeOnly') activeOnly?: string) {
    return this.warehouseService.list(activeOnly !== 'false');
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.warehouseService.findById(id);
  }

  @Post()
  create(@Body() body: WarehouseInput) {
    return this.warehouseService.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Partial<WarehouseInput>) {
    return this.warehouseService.update(id, body);
  }

  @Post(':id/toggle-active')
  toggleActive(@Param('id') id: string, @Body() body: { isActive: boolean }) {
    return this.warehouseService.setActive(id, body.isActive);
  }
}

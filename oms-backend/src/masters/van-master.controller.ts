import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { VanMasterService, VanInput } from './van-master.service';

@Controller('vans')
export class VanMasterController {
  constructor(private readonly vanMasterService: VanMasterService) {}

  @Get()
  list(@Query('activeOnly') activeOnly?: string) {
    return this.vanMasterService.list(activeOnly !== 'false');
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.vanMasterService.findById(id);
  }

  @Post()
  create(@Body() body: VanInput) {
    return this.vanMasterService.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Partial<VanInput>) {
    return this.vanMasterService.update(id, body);
  }

  @Post(':id/toggle-active')
  toggleActive(@Param('id') id: string, @Body() body: { isActive: boolean }) {
    return this.vanMasterService.setActive(id, body.isActive);
  }
}

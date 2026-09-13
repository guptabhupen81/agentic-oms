import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { RetailerService, RetailerInput } from './retailer.service';

@Controller('retailers')
export class RetailerController {
  constructor(private readonly retailerService: RetailerService) {}

  @Get()
  list(@Query('activeOnly') activeOnly?: string) {
    return this.retailerService.list(activeOnly !== 'false');
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.retailerService.findById(id);
  }

  @Post()
  create(@Body() body: RetailerInput) {
    return this.retailerService.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Partial<RetailerInput>) {
    return this.retailerService.update(id, body);
  }

  @Post(':id/toggle-active')
  toggleActive(@Param('id') id: string, @Body() body: { isActive: boolean }) {
    return this.retailerService.setActive(id, body.isActive);
  }
}

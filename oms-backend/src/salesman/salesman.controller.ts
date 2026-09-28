import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { SalesmanService, SalesmanInput } from './salesman.service';

@Controller('salesmen')
export class SalesmanController {
  constructor(private readonly salesmanService: SalesmanService) {}

  @Get()
  list(@Query('activeOnly') activeOnly?: string) {
    return this.salesmanService.list(activeOnly !== 'false');
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.salesmanService.findById(id);
  }

  @Post()
  create(@Body() body: SalesmanInput) {
    return this.salesmanService.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Partial<SalesmanInput>) {
    return this.salesmanService.update(id, body);
  }

  @Post(':id/toggle-active')
  toggleActive(@Param('id') id: string, @Body() body: { isActive: boolean }) {
    return this.salesmanService.setActive(id, body.isActive);
  }

  // --- Retailer mapping ---

  @Get('retailer-mappings/:retailerId')
  listMappingsForRetailer(@Param('retailerId') retailerId: string) {
    return this.salesmanService.listMappingsForRetailer(retailerId);
  }

  @Post('retailer-mappings')
  mapToRetailer(@Body() body: { retailerId: string; salesmanId: string }) {
    return this.salesmanService.mapToRetailer(body.retailerId, body.salesmanId);
  }

  @Delete('retailer-mappings/:mappingId')
  unmapFromRetailer(@Param('mappingId') mappingId: string) {
    return this.salesmanService.unmapFromRetailer(mappingId);
  }

  // --- Van mapping ---

  @Post(':id/assign-van')
  assignVan(@Param('id') id: string, @Body() body: { vanId: string }) {
    return this.salesmanService.assignVan(id, body.vanId);
  }

  @Post(':id/unassign-van')
  unassignVan(@Param('id') id: string, @Body() body: { vanId: string }) {
    return this.salesmanService.unassignVan(body.vanId);
  }
}

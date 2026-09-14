import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { PicklistService } from './picklist.service';

@Controller('picklists')
export class PicklistController {
  constructor(private readonly picklistService: PicklistService) {}

  @Post('generate')
  generate(@Body() body: { orderIds: string[] }) {
    return this.picklistService.generatePicklists(body.orderIds);
  }

  @Get()
  listRecent(@Query('limit') limit?: string) {
    return this.picklistService.listRecent(limit ? Number(limit) : undefined);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.picklistService.findById(id);
  }

  @Post(':id/assign')
  assign(@Param('id') id: string, @Body() body: { userId: string }) {
    return this.picklistService.assignToWarehouseIncharge(id, body.userId);
  }

  @Post('lines/:lineId/pick')
  recordPick(@Param('lineId') lineId: string, @Body() body: { pickedQty: number }) {
    return this.picklistService.recordPick(lineId, body.pickedQty);
  }

  @Post(':id/complete')
  complete(@Param('id') id: string) {
    return this.picklistService.completePicklist(id);
  }
}

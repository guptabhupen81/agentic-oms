import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { VanService } from './van.service';

@Controller('van-loads')
export class VanController {
  constructor(private readonly vanService: VanService) {}

  @Post()
  load(
    @Body()
    body: {
      vanId: string;
      warehouseId: string;
      operatorId: string;
      lines: { batchId: string; quantity: number }[];
    },
  ) {
    return this.vanService.loadVan(body.vanId, body.warehouseId, body.operatorId, body.lines);
  }

  @Get()
  listRecent(@Query('limit') limit?: string) {
    return this.vanService.listRecent(limit ? Number(limit) : undefined);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.vanService.findById(id);
  }

  @Post(':id/sale')
  recordSale(
    @Param('id') id: string,
    @Body()
    body: {
      lines: { vanLoadLineId: string; quantity: number; rate: number }[];
      isIgst: boolean;
      placeOfSupply: string;
    },
  ) {
    return this.vanService.recordSale(id, body.lines, body.isIgst, body.placeOfSupply);
  }

  @Post(':id/unload')
  unload(@Param('id') id: string) {
    return this.vanService.unloadVan(id);
  }
}

import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { PurchaseService } from './purchase.service';

@Controller('purchase')
export class PurchaseController {
  constructor(private readonly purchaseService: PurchaseService) {}

  @Get('recommendations')
  recommend(
    @Query('warehouseId') warehouseId: string,
    @Query('leadTimeDays') leadTimeDays = '10',
    @Query('targetCoverDays') targetCoverDays = '21',
  ) {
    return this.purchaseService.recommendReplenishment(
      warehouseId,
      Number(leadTimeDays),
      Number(targetCoverDays),
    );
  }

  @Get('orders')
  listOrders(@Query('limit') limit?: string) {
    return this.purchaseService.listPurchaseOrders(limit ? Number(limit) : undefined);
  }

  @Post('orders')
  create(
    @Body() body: { manufacturerId: string; lines: { productId: string; orderedQty: number }[] },
  ) {
    return this.purchaseService.createPurchaseOrder(body.manufacturerId, body.lines);
  }

  @Post('orders/:id/resolve-hold')
  resolveHold(@Param('id') id: string, @Body() body: { outcome: 'approved' | 'rejected' }, @Req() req: any) {
    return this.purchaseService.resolvePOHold(id, body.outcome, req.user?.userId);
  }

  @Post('orders/receive')
  receive(
    @Body()
    body: {
      purchaseOrderLineId: string;
      batchNumber: string;
      manufactureDate: string;
      expiryDate: string;
      receivedQty: number;
      warehouseId: string;
    },
  ) {
    return this.purchaseService.receivePurchaseOrderLine(
      body.purchaseOrderLineId,
      body.batchNumber,
      new Date(body.manufactureDate),
      new Date(body.expiryDate),
      body.receivedQty,
      body.warehouseId,
    );
  }
}

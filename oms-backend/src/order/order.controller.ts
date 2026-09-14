import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto';

@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  create(@Body() dto: CreateOrderDto) {
    return this.orderService.createOrder(dto);
  }

  @Get()
  listRecent(@Query('limit') limit?: string) {
    return this.orderService.listRecent(limit ? Number(limit) : undefined);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.orderService.findById(id);
  }

  /** Order/invoice value preview — same calculation the credit-limit check
   * and the eventual real invoice both use. */
  @Get(':id/value')
  getValue(@Param('id') id: string) {
    return this.orderService.computeOrderValue(id);
  }

  @Get('sync/for-user')
  syncForUser(@Query('userId') userId: string, @Query('since') since?: string) {
    const sinceDate = since ? new Date(since) : new Date(0);
    return this.orderService.listForUserSince(userId, sinceDate);
  }

  /** Order Agent's 3-check validation (stock, credit, min/max qty). */
  @Post(':id/validate')
  validate(@Param('id') id: string, @Body() body: { warehouseId: string }) {
    return this.orderService.validateOrder(id, body.warehouseId);
  }

  /** Human resolution of a failed validation — approve overrides, reject cancels. */
  @Post(':id/resolve-validation')
  resolveValidation(@Param('id') id: string, @Body() body: { outcome: 'approved' | 'rejected' }, @Req() req: any) {
    const userId = req.user?.userId;
    return this.orderService.resolveValidation(id, body.outcome, userId);
  }
}

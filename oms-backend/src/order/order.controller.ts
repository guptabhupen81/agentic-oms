import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto';

@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  create(@Body() dto: CreateOrderDto) {
    return this.orderService.createOrder(dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.orderService.findById(id);
  }

  @Get('sync/for-user')
  syncForUser(@Query('userId') userId: string, @Query('since') since?: string) {
    const sinceDate = since ? new Date(since) : new Date(0);
    return this.orderService.listForUserSince(userId, sinceDate);
  }
}

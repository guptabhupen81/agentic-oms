import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto';
import { OrderStatus } from '@prisma/client';

@Injectable()
export class OrderService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Idempotent create: used both for direct web creation and for the mobile
   * upload-on-sync flow. If clientOrderId was already uploaded (e.g. the app
   * retried after a dropped connection), the existing order is returned
   * unchanged rather than creating a duplicate.
   */
  async createOrder(dto: CreateOrderDto) {
    const existing = await this.prisma.order.findUnique({
      where: { clientOrderId: dto.clientOrderId },
      include: { lines: true },
    });
    if (existing) return existing;

    const orderNumber = await this.generateOrderNumber();

    return this.prisma.order.create({
      data: {
        orderNumber,
        clientOrderId: dto.clientOrderId,
        retailerId: dto.retailerId,
        createdById: dto.createdById,
        sourceType: dto.sourceType,
        status: OrderStatus.DRAFT,
        lines: {
          create: dto.lines.map((l) => ({
            productId: l.productId,
            orderedQty: l.orderedQty,
          })),
        },
      },
      include: { lines: true },
    });
  }

  async findById(id: string) {
    return this.prisma.order.findUnique({
      where: { id },
      include: { lines: true, invoices: true },
    });
  }

  /** Delta sync for mobile: orders relevant to a user updated since last sync. */
  async listForUserSince(userId: string, since: Date) {
    return this.prisma.order.findMany({
      where: { createdById: userId, orderDate: { gte: since } },
      include: { lines: true },
    });
  }

  private async generateOrderNumber(): Promise<string> {
    const count = await this.prisma.order.count();
    const year = new Date().getFullYear();
    return `ORD-${year}-${String(count + 1).padStart(6, '0')}`;
  }
}

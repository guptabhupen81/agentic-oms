import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto';
import { AgentTaskStatus, AgentTaskType, OrderStatus } from '@prisma/client';
import { AgentTaskService } from '../agent-task/agent-task.service';
import Decimal from 'decimal.js';

export interface ValidationCheckResult {
  name: string;
  passed: boolean;
  detail: string;
}

export interface ValidateOrderResult {
  orderId: string;
  passed: boolean;
  checks: ValidationCheckResult[];
  agentTaskId?: string;
  dueAt?: string;
}

const VALIDATION_HOLD_MINUTES = 30;

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agentTaskService: AgentTaskService,
  ) {}

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

  /**
   * Order Agent's 3-check validation, exactly as specced: stock availability,
   * credit limit, and min/max order quantity. All checks run and are
   * reported even after the first failure — so a reviewer sees the whole
   * picture, not just "something's wrong." Any failure puts the order on
   * VALIDATION_HOLD and opens a real AgentTask (with a genuine 30-minute
   * dueAt timestamp), rather than blocking silently.
   */
  async validateOrder(orderId: string, warehouseId: string): Promise<ValidateOrderResult> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { lines: { include: { product: true } }, retailer: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    const checks: ValidationCheckResult[] = [];

    // Check 1: stock availability per line, at the given warehouse.
    let stockOk = true;
    for (const line of order.lines) {
      const stocks = await this.prisma.inventoryStock.findMany({
        where: { warehouseId, productId: line.productId },
      });
      const free = stocks.reduce(
        (sum: Decimal, s: any) => sum.plus(new Decimal(s.quantityOnHand.toString()).minus(s.quantityAllocated.toString())),
        new Decimal(0),
      );
      const needed = new Decimal(line.orderedQty.toString());
      if (free.lt(needed)) {
        stockOk = false;
        checks.push({
          name: 'Stock availability',
          passed: false,
          detail: `${line.product.name}: ${free.toString()} available, ${needed.toString()} requested`,
        });
      }
    }
    if (stockOk) checks.push({ name: 'Stock availability', passed: true, detail: 'All lines covered by free stock' });

    // Check 2: credit limit — order value against retailer's remaining credit.
    const orderValue = order.lines.reduce(
      (sum: Decimal, line: any) =>
        sum.plus(new Decimal(line.orderedQty.toString()).mul(line.product.defaultUnitPrice.toString())),
      new Decimal(0),
    );
    const creditRemaining = new Decimal(order.retailer.creditLimitAmount.toString()).minus(
      order.retailer.creditUsedAmount.toString(),
    );
    const creditOk = orderValue.lte(creditRemaining);
    checks.push({
      name: 'Credit limit',
      passed: creditOk,
      detail: creditOk
        ? `Order value ₹${orderValue.toFixed(2)} within ₹${creditRemaining.toFixed(2)} remaining credit`
        : `Order value ₹${orderValue.toFixed(2)} exceeds ₹${creditRemaining.toFixed(2)} remaining credit`,
    });

    // Check 3: min/max order quantity per line (only where the product defines one).
    let qtyOk = true;
    for (const line of order.lines) {
      const qty = new Decimal(line.orderedQty.toString());
      const min = line.product.minOrderQty ? new Decimal(line.product.minOrderQty.toString()) : null;
      const max = line.product.maxOrderQty ? new Decimal(line.product.maxOrderQty.toString()) : null;
      if ((min && qty.lt(min)) || (max && qty.gt(max))) {
        qtyOk = false;
        checks.push({
          name: 'Order quantity',
          passed: false,
          detail: `${line.product.name}: ${qty.toString()} outside allowed ${min ?? '—'}–${max ?? '—'}`,
        });
      }
    }
    if (qtyOk) checks.push({ name: 'Order quantity', passed: true, detail: 'All lines within min/max range' });

    const passed = checks.every((c) => c.passed);

    if (passed) {
      await this.prisma.order.update({ where: { id: orderId }, data: { status: OrderStatus.DRAFT } });
      await this.agentTaskService.logEvent(
        'Order Agent',
        'Order',
        orderId,
        `Validated ${order.orderNumber} — all checks passed`,
      );
      return { orderId, passed: true, checks };
    }

    const dueAt = new Date(Date.now() + VALIDATION_HOLD_MINUTES * 60 * 1000);
    await this.prisma.order.update({ where: { id: orderId }, data: { status: OrderStatus.VALIDATION_HOLD } });
    const task = await this.agentTaskService.create({
      taskType: AgentTaskType.ORDER_VALIDATION,
      entityType: 'Order',
      entityId: orderId,
      reasonNote: checks
        .filter((c) => !c.passed)
        .map((c) => `${c.name}: ${c.detail}`)
        .join('; '),
      dueAt,
    });

    return { orderId, passed: false, checks, agentTaskId: task.id, dueAt: dueAt.toISOString() };
  }

  /** Resolves the ORDER_VALIDATION task for this order — approve overrides the
   * failed check(s) and lets the order proceed; reject cancels it outright. */
  async resolveValidation(orderId: string, outcome: 'approved' | 'rejected', userId: string) {
    const task = await this.agentTaskService.findPending('Order', orderId, AgentTaskType.ORDER_VALIDATION);
    if (!task) throw new BadRequestException('No pending validation task for this order');

    await this.agentTaskService.markResolved(
      task.id,
      outcome === 'approved' ? AgentTaskStatus.APPROVED : AgentTaskStatus.REJECTED,
      userId,
    );

    const newStatus = outcome === 'approved' ? OrderStatus.DRAFT : OrderStatus.CANCELLED;
    await this.prisma.order.update({ where: { id: orderId }, data: { status: newStatus } });

    return { orderId, status: newStatus };
  }

  private async generateOrderNumber(): Promise<string> {
    const count = await this.prisma.order.count();
    const year = new Date().getFullYear();
    return `ORD-${year}-${String(count + 1).padStart(6, '0')}`;
  }
}

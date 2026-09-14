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

export interface OrderValueLine {
  orderLineId: string;
  productId: string;
  productName: string;
  orderedQty: string;
  unitPrice: string;
  discountPercent: string;
  isFreeItem: boolean;
  taxableValue: string;
  taxAmount: string;
  lineTotal: string;
}

export interface OrderValueResult {
  orderId: string;
  overallDiscountPercent: string;
  lines: OrderValueLine[];
  subTotal: string;
  totalTax: string;
  totalValue: string;
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
        overallDiscountPercent: dto.overallDiscountPercent ?? 0,
        lines: {
          create: dto.lines.map((l) => ({
            productId: l.productId,
            orderedQty: l.orderedQty,
            discountPercent: l.discountPercent ?? 0,
            isFreeItem: l.isFreeItem ?? false,
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

  /** Recent orders across all users — powers the transaction list on the
   * Orders page. Includes each order's computed value so the list itself is
   * useful without an extra round-trip per row. */
  async listRecent(limit = 50) {
    const orders = await this.prisma.order.findMany({
      orderBy: { orderDate: 'desc' },
      take: limit,
      include: { retailer: true, lines: { include: { product: true } } },
    });

    return orders.map((order: any) => ({
      ...order,
      estimatedValue: this.calculateOrderTotals(order).totalValue,
    }));
  }

  /** Delta sync for mobile: orders relevant to a user updated since last sync. */
  async listForUserSince(userId: string, since: Date) {
    return this.prisma.order.findMany({
      where: { createdById: userId, orderDate: { gte: since } },
      include: { lines: true },
    });
  }

  /**
   * Order/invoice value preview: per-line discount applied first, then the
   * bill-level overall discount scales each already-discounted line
   * proportionally (so each product's own GST rate still applies correctly
   * to its own reduced share), then tax is computed on that final taxable
   * value. Free items are zeroed out entirely regardless of discountPercent.
   * This is the SAME calculation InvoiceService uses when the real invoice
   * is generated later, so the preview a user sees here never diverges from
   * what they're actually billed.
   */
  async computeOrderValue(orderId: string): Promise<OrderValueResult> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { lines: { include: { product: true } } },
    });
    if (!order) throw new NotFoundException('Order not found');

    const totals = this.calculateOrderTotals(order);
    return { orderId, ...totals };
  }

  /** Shared by computeOrderValue() and listRecent() so the number a user
   * previews and the number shown in the order list are always identical. */
  private calculateOrderTotals(order: any): Omit<OrderValueResult, 'orderId'> {
    const overallDiscountPercent = new Decimal(order.overallDiscountPercent?.toString() ?? '0');
    const overallScale = new Decimal(1).minus(overallDiscountPercent.div(100));

    const lines: OrderValueLine[] = [];
    let subTotal = new Decimal(0);
    let totalTax = new Decimal(0);

    for (const line of order.lines) {
      const qty = new Decimal(line.orderedQty.toString());
      const unitPrice = new Decimal(line.product.defaultUnitPrice.toString());
      const discountPercent = new Decimal(line.discountPercent?.toString() ?? '0');
      const gstRate = new Decimal(line.product.gstRatePercent.toString()).div(100);

      let taxableValue = new Decimal(0);
      let taxAmount = new Decimal(0);

      if (!line.isFreeItem) {
        const gross = qty.mul(unitPrice);
        const afterLineDiscount = gross.mul(new Decimal(1).minus(discountPercent.div(100)));
        taxableValue = afterLineDiscount.mul(overallScale);
        taxAmount = taxableValue.mul(gstRate);
      }

      subTotal = subTotal.plus(taxableValue);
      totalTax = totalTax.plus(taxAmount);

      lines.push({
        orderLineId: line.id,
        productId: line.productId,
        productName: line.product.name,
        orderedQty: qty.toFixed(3),
        unitPrice: unitPrice.toFixed(2),
        discountPercent: discountPercent.toFixed(2),
        isFreeItem: line.isFreeItem,
        taxableValue: taxableValue.toFixed(2),
        taxAmount: taxAmount.toFixed(2),
        lineTotal: taxableValue.plus(taxAmount).toFixed(2),
      });
    }

    return {
      overallDiscountPercent: overallDiscountPercent.toFixed(2),
      lines,
      subTotal: subTotal.toFixed(2),
      totalTax: totalTax.toFixed(2),
      totalValue: subTotal.plus(totalTax).toFixed(2),
    };
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

    // Check 2: credit limit — uses the SAME discount-aware order value as the
    // preview/invoice, not a raw qty*price figure, so discounts and free
    // items correctly reduce how much credit an order actually consumes.
    const orderValue = new Decimal(this.calculateOrderTotals(order).totalValue);
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

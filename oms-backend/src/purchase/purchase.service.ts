import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AgentTaskService } from '../agent-task/agent-task.service';
import { AgentTaskStatus, AgentTaskType, PurchaseOrderStatus } from '@prisma/client';
import Decimal from 'decimal.js';

interface ReplenishmentRecommendation {
  productId: string;
  sku: string;
  manufacturerId: string;
  currentStock: string;
  averageDailySales: string;
  daysOfCoverRemaining: string;
  recommendedOrderQty: string;
  rationale: string;
}

const PO_HOLD_MINUTES = 30;

@Injectable()
export class PurchaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agentTaskService: AgentTaskService,
  ) {}

  /**
   * Purchase Agent (recommendation piece): flags products whose current
   * warehouse stock covers fewer days than the manufacturer's typical lead
   * time, and proposes a replenishment quantity. leadTimeDays and
   * targetCoverDays are simplified inputs here; a fuller version would pull
   * these per-manufacturer and factor in seasonality.
   */
  async recommendReplenishment(
    warehouseId: string,
    leadTimeDays: number,
    targetCoverDays: number,
    lookbackDays = 30,
  ): Promise<ReplenishmentRecommendation[]> {
    const since = new Date();
    since.setDate(since.getDate() - lookbackDays);

    const stocks = await this.prisma.inventoryStock.groupBy({
      by: ['productId'],
      where: { warehouseId },
      _sum: { quantityOnHand: true },
    });

    const recommendations: ReplenishmentRecommendation[] = [];

    for (const stock of stocks) {
      const soldQtyAgg = await this.prisma.invoiceLine.aggregate({
        where: {
          orderLine: { productId: stock.productId },
          invoice: { invoiceDate: { gte: since } },
        },
        _sum: { quantity: true },
      });

      const product = await this.prisma.product.findUnique({ where: { id: stock.productId } });
      if (!product) continue;

      const totalSold = new Decimal(soldQtyAgg._sum.quantity?.toString() ?? '0');
      const avgDailySales = totalSold.div(lookbackDays);
      const currentStock = new Decimal(stock._sum.quantityOnHand?.toString() ?? '0');

      if (avgDailySales.eq(0)) continue; // no sales history -> nothing to recommend yet

      const daysOfCover = currentStock.div(avgDailySales);

      if (daysOfCover.lt(leadTimeDays)) {
        const targetStock = avgDailySales.mul(targetCoverDays);
        const recommendedQty = Decimal.max(targetStock.minus(currentStock), 0);

        recommendations.push({
          productId: product.id,
          sku: product.sku,
          manufacturerId: product.manufacturerId,
          currentStock: currentStock.toFixed(2),
          averageDailySales: avgDailySales.toFixed(2),
          daysOfCoverRemaining: daysOfCover.toFixed(1),
          recommendedOrderQty: recommendedQty.toFixed(0),
          rationale: `Stock covers ${daysOfCover.toFixed(1)} days against a ${leadTimeDays}-day manufacturer lead time; recommending enough to reach ${targetCoverDays} days of cover.`,
        });
      }
    }

    return recommendations;
  }

  /**
   * Drafts a PO and immediately opens a real PO_HOLD task, dueAt = now + 30
   * minutes — mirrors the Order Validation pattern exactly. Approving
   * simulates the auto-send-to-SAP step (status -> SENT); rejecting cancels
   * the PO outright.
   */
  async createPurchaseOrder(manufacturerId: string, lines: { productId: string; orderedQty: number }[]) {
    const poNumber = await this.generatePoNumber();
    const po = await this.prisma.purchaseOrder.create({
      data: {
        poNumber,
        manufacturerId,
        lines: { create: lines.map((l) => ({ productId: l.productId, orderedQty: l.orderedQty })) },
      },
      include: { lines: { include: { product: true } }, manufacturer: true },
    });

    const dueAt = new Date(Date.now() + PO_HOLD_MINUTES * 60 * 1000);
    const lineSummary = po.lines.map((l: any) => `${l.product.name} x${l.orderedQty}`).join(', ');

    await this.agentTaskService.create({
      taskType: AgentTaskType.PO_HOLD,
      entityType: 'PurchaseOrder',
      entityId: po.id,
      reasonNote: `${po.poNumber} for ${po.manufacturer.name}: ${lineSummary}`,
      dueAt,
    });

    return { ...po, holdDueAt: dueAt.toISOString() };
  }

  /** Resolves the PO_HOLD task — approve simulates sending to SAP, reject cancels. */
  async resolvePOHold(purchaseOrderId: string, outcome: 'approved' | 'rejected', userId: string) {
    const task = await this.agentTaskService.findPending('PurchaseOrder', purchaseOrderId, AgentTaskType.PO_HOLD);
    if (!task) throw new BadRequestException('No pending hold task for this purchase order');

    await this.agentTaskService.markResolved(
      task.id,
      outcome === 'approved' ? AgentTaskStatus.APPROVED : AgentTaskStatus.REJECTED,
      userId,
    );

    const newStatus = outcome === 'approved' ? PurchaseOrderStatus.SENT : PurchaseOrderStatus.CANCELLED;
    await this.prisma.purchaseOrder.update({ where: { id: purchaseOrderId }, data: { status: newStatus } });

    await this.agentTaskService.logEvent(
      'Demand Agent',
      'PurchaseOrder',
      purchaseOrderId,
      outcome === 'approved' ? 'Released to SAP outbox' : 'Cancelled by reviewer',
    );

    return { purchaseOrderId, status: newStatus };
  }

  async listPurchaseOrders(limit = 50) {
    return this.prisma.purchaseOrder.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { manufacturer: true, lines: { include: { product: true } } },
    });
  }

  /** Manufacturer issues the batch/expiry at GRN time — this is where Batch rows are born. */
  async receivePurchaseOrderLine(
    purchaseOrderLineId: string,
    batchNumber: string,
    manufactureDate: Date,
    expiryDate: Date,
    receivedQty: number,
    warehouseId: string,
  ) {
    const line = await this.prisma.purchaseOrderLine.findUnique({
      where: { id: purchaseOrderLineId },
      include: { purchaseOrder: true },
    });
    if (!line) throw new Error('Purchase order line not found');

    return this.prisma.$transaction(async (tx: any) => {
      const batch = await tx.batch.create({
        data: {
          batchNumber,
          productId: line.productId,
          manufacturerId: line.purchaseOrder.manufacturerId,
          manufactureDate,
          expiryDate,
        },
      });

      await tx.purchaseOrderLine.update({
        where: { id: purchaseOrderLineId },
        data: { receivedQty: { increment: receivedQty }, batchId: batch.id },
      });

      await tx.inventoryStock.upsert({
        where: { warehouseId_batchId: { warehouseId, batchId: batch.id } },
        update: { quantityOnHand: { increment: receivedQty.toString() } },
        create: {
          warehouseId,
          batchId: batch.id,
          productId: line.productId,
          quantityOnHand: receivedQty.toString(),
        },
      });

      return batch;
    });
  }

  private async generatePoNumber(): Promise<string> {
    const count = await this.prisma.purchaseOrder.count();
    const year = new Date().getFullYear();
    return `PO-${year}-${String(count + 1).padStart(6, '0')}`;
  }
}

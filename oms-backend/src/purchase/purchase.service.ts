import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import Decimal from 'decimal.js';

interface ReplenishmentRecommendation {
  productId: string;
  sku: string;
  currentStock: string;
  averageDailySales: string;
  daysOfCoverRemaining: string;
  recommendedOrderQty: string;
  rationale: string;
}

@Injectable()
export class PurchaseService {
  constructor(private readonly prisma: PrismaService) {}

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

  async createPurchaseOrder(
    manufacturerId: string,
    lines: { productId: string; orderedQty: number }[],
  ) {
    const poNumber = await this.generatePoNumber();
    return this.prisma.purchaseOrder.create({
      data: {
        poNumber,
        manufacturerId,
        lines: { create: lines.map((l) => ({ productId: l.productId, orderedQty: l.orderedQty })) },
      },
      include: { lines: true },
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

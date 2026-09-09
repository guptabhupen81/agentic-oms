import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus } from '@prisma/client';
import Decimal from 'decimal.js';

export interface AllocationDecisionLine {
  orderLineId: string;
  productId: string;
  orderedQty: string;
  allocatedQty: string;
  shortfallQty: string;
  batchesUsed: {
    batchId: string;
    batchNumber: string;
    expiryDate: Date;
    qtyTaken: string;
  }[];
}

export interface AllocationResult {
  orderId: string;
  fullyAllocated: boolean;
  lines: AllocationDecisionLine[];
}

/**
 * Order Allocation Agent.
 *
 * Responsibility: given an order, decide which specific batches fulfil each
 * line, applying FEFO (First Expiry First Out). Every decision is written to
 * the Allocation table with a human-readable reason, so the "agent" behaviour
 * is auditable rather than a black box — this is deliberate: allocation
 * correctness (money, stock, expiry compliance) should never rely purely on
 * an LLM's judgement. An LLM-based agent can sit in front of this service to
 * explain results, flag anomalies, or negotiate partial-fulfilment tradeoffs
 * with a human — but the allocation arithmetic itself is deterministic.
 */
@Injectable()
export class AllocationService {
  private readonly logger = new Logger(AllocationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async allocateOrder(orderId: string, warehouseId: string): Promise<AllocationResult> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { lines: true },
    });
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);

    const decisionLines: AllocationDecisionLine[] = [];
    let fullyAllocated = true;

    // Process line by line inside a single transaction so a partially-run
    // allocation never leaves inventory in an inconsistent state.
    await this.prisma.$transaction(async (tx: any) => {
      for (const line of order.lines) {
        const remainingNeeded = new Decimal(line.orderedQty.toString()).minus(
          line.allocatedQty.toString(),
        );
        if (remainingNeeded.lte(0)) continue;

        // FEFO: earliest expiry first, among batches with free (unallocated) stock
        // at this warehouse.
        const candidateStocks = await tx.inventoryStock.findMany({
          where: {
            warehouseId,
            productId: line.productId,
          },
          include: { batch: true },
          orderBy: { batch: { expiryDate: 'asc' } },
        });

        let stillNeeded = remainingNeeded;
        const batchesUsed: AllocationDecisionLine['batchesUsed'] = [];

        for (const stock of candidateStocks) {
          if (stillNeeded.lte(0)) break;

          const freeQty = new Decimal(stock.quantityOnHand.toString()).minus(
            stock.quantityAllocated.toString(),
          );
          if (freeQty.lte(0)) continue;

          const takeQty = Decimal.min(freeQty, stillNeeded);

          await tx.allocation.create({
            data: {
              orderLineId: line.id,
              batchId: stock.batchId,
              warehouseId,
              allocatedQty: takeQty.toFixed(3),
              reasonNote: `FEFO: batch ${stock.batch.batchNumber} expires ${stock.batch.expiryDate
                .toISOString()
                .slice(0, 10)}, ${candidateStocks.length} batch(es) available for this product at warehouse`,
            },
          });

          await tx.inventoryStock.update({
            where: { id: stock.id },
            data: { quantityAllocated: { increment: takeQty.toFixed(3) } },
          });

          batchesUsed.push({
            batchId: stock.batchId,
            batchNumber: stock.batch.batchNumber,
            expiryDate: stock.batch.expiryDate,
            qtyTaken: takeQty.toFixed(3),
          });

          stillNeeded = stillNeeded.minus(takeQty);
        }

        const newAllocatedQty = new Decimal(line.allocatedQty.toString()).plus(
          remainingNeeded.minus(stillNeeded),
        );

        await tx.orderLine.update({
          where: { id: line.id },
          data: { allocatedQty: newAllocatedQty.toFixed(3) },
        });

        if (stillNeeded.gt(0)) fullyAllocated = false;

        decisionLines.push({
          orderLineId: line.id,
          productId: line.productId,
          orderedQty: line.orderedQty.toString(),
          allocatedQty: newAllocatedQty.toFixed(3),
          shortfallQty: stillNeeded.toFixed(3),
          batchesUsed,
        });
      }

      await tx.order.update({
        where: { id: orderId },
        data: {
          status: fullyAllocated ? OrderStatus.ALLOCATED : OrderStatus.PARTIALLY_ALLOCATED,
        },
      });
    });

    this.logger.log(
      `Order ${orderId} allocation complete. Fully allocated: ${fullyAllocated}`,
    );

    return { orderId, fullyAllocated, lines: decisionLines };
  }

  /** Fetches the recorded reasoning for an already-allocated order — used by
   * the Agent layer to answer "why was this order allocated this way?" */
  async explainAllocation(orderId: string) {
    const allocations = await this.prisma.allocation.findMany({
      where: { orderLine: { orderId } },
      include: { batch: true, orderLine: { include: { product: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return allocations.map((a: any) => ({
      product: a.orderLine.product.name,
      batchNumber: a.batch.batchNumber,
      expiryDate: a.batch.expiryDate,
      allocatedQty: a.allocatedQty.toString(),
      reasonNote: a.reasonNote,
    }));
  }
}

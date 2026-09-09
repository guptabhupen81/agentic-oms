import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import Decimal from 'decimal.js';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  /** Stock on hand for a warehouse, broken out by batch (so FEFO order is visible). */
  async getWarehouseStock(warehouseId: string) {
    return this.prisma.inventoryStock.findMany({
      where: { warehouseId },
      include: { product: true, batch: true },
      orderBy: [{ productId: 'asc' }, { batch: { expiryDate: 'asc' } }],
    });
  }

  /**
   * Manual stock adjustment (damage, physical count correction, etc).
   * delta may be positive or negative; negative adjustments are rejected if
   * they would take on-hand below what's already allocated to orders.
   */
  async adjustStock(warehouseId: string, batchId: string, delta: number, reason: string) {
    const stock = await this.prisma.inventoryStock.findUnique({
      where: { warehouseId_batchId: { warehouseId, batchId } },
    });
    if (!stock) throw new BadRequestException('No stock record for this warehouse/batch');

    const newOnHand = new Decimal(stock.quantityOnHand.toString()).plus(delta);
    if (newOnHand.lt(stock.quantityAllocated.toString())) {
      throw new BadRequestException(
        'Adjustment would take on-hand quantity below what is already allocated to orders',
      );
    }

    return this.prisma.inventoryStock.update({
      where: { id: stock.id },
      data: { quantityOnHand: newOnHand.toFixed(3) },
    });
  }

  /**
   * Stock transfer between warehouses, or warehouse -> van load. Header +
   * lines are created in DRAFT/IN_TRANSIT; completing the transfer (separate
   * call, e.g. on receipt confirmation) is what actually moves InventoryStock.
   */
  async createTransfer(
    fromWarehouseId: string,
    toWarehouseId: string | null,
    lines: { batchId: string; quantity: number }[],
  ) {
    return this.prisma.stockTransfer.create({
      data: {
        fromWarehouseId,
        toWarehouseId: toWarehouseId ?? undefined,
        lines: { create: lines.map((l) => ({ batchId: l.batchId, quantity: l.quantity })) },
      },
      include: { lines: true },
    });
  }

  async completeTransfer(transferId: string) {
    const transfer = await this.prisma.stockTransfer.findUnique({
      where: { id: transferId },
      include: { lines: { include: { batch: true } } },
    });
    if (!transfer) throw new BadRequestException('Transfer not found');

    await this.prisma.$transaction(async (tx: any) => {
      for (const line of transfer.lines) {
        // Deduct from source warehouse
        await tx.inventoryStock.update({
          where: {
            warehouseId_batchId: { warehouseId: transfer.fromWarehouseId, batchId: line.batchId },
          },
          data: { quantityOnHand: { decrement: line.quantity.toString() } },
        });

        // Add to destination warehouse, if it's a warehouse-to-warehouse transfer
        // (warehouse-to-van transfers are represented by a VanLoad instead).
        if (transfer.toWarehouseId) {
          await tx.inventoryStock.upsert({
            where: {
              warehouseId_batchId: { warehouseId: transfer.toWarehouseId, batchId: line.batchId },
            },
            update: { quantityOnHand: { increment: line.quantity.toString() } },
            create: {
              warehouseId: transfer.toWarehouseId,
              batchId: line.batchId,
              productId: line.batch.productId,
              quantityOnHand: line.quantity.toString(),
            },
          });
        }
      }

      await tx.stockTransfer.update({
        where: { id: transferId },
        data: { status: 'COMPLETED' },
      });
    });

    return this.prisma.stockTransfer.findUnique({ where: { id: transferId } });
  }
}

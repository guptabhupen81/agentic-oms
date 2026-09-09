import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InvoiceService } from '../invoice/invoice.service';
import { VanLoadStatus } from '@prisma/client';
import Decimal from 'decimal.js';

interface LoadLineInput {
  batchId: string;
  quantity: number;
}

interface SaleLineInput {
  vanLoadLineId: string;
  quantity: number;
  rate: number;
}

@Injectable()
export class VanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoiceService: InvoiceService,
  ) {}

  /**
   * Load stock from a warehouse onto a van. Deducts on-hand warehouse
   * inventory immediately (goods have physically left the warehouse) — this
   * is intentionally simpler than the Order path: there's no "allocation"
   * step because a van load isn't reserved against a customer order, it's a
   * bulk physical movement the Van Seller will sell against in the field.
   * Still applies FEFO by default (earliest-expiry batches loaded first)
   * unless the caller names specific batches.
   */
  async loadVan(vanId: string, warehouseId: string, operatorId: string, lines: LoadLineInput[]) {
    return this.prisma.$transaction(async (tx: any) => {
      const vanLoad = await tx.vanLoad.create({
        data: { vanId, warehouseId, operatorId, status: VanLoadStatus.LOADED },
      });

      for (const line of lines) {
        const stock = await tx.inventoryStock.findUnique({
          where: { warehouseId_batchId: { warehouseId, batchId: line.batchId } },
        });
        if (!stock) throw new BadRequestException(`No stock for batch ${line.batchId} at this warehouse`);

        const freeQty = new Decimal(stock.quantityOnHand.toString()).minus(stock.quantityAllocated.toString());
        if (freeQty.lt(line.quantity)) {
          throw new BadRequestException(
            `Insufficient free stock for batch ${line.batchId}: ${freeQty.toString()} available, ${line.quantity} requested`,
          );
        }

        await tx.inventoryStock.update({
          where: { id: stock.id },
          data: { quantityOnHand: { decrement: line.quantity.toString() } },
        });

        await tx.vanLoadLine.create({
          data: { vanLoadId: vanLoad.id, batchId: line.batchId, loadedQty: line.quantity },
        });
      }

      return tx.vanLoad.findUnique({ where: { id: vanLoad.id }, include: { lines: true } });
    });
  }

  /**
   * Van direct sale: no prior Order exists. Records soldQty against the
   * relevant VanLoadLine(s) and generates a GST invoice on the spot, via the
   * same InvoiceService the Order path uses — one place computes GST for the
   * whole system, whether the sale started as an Order or not.
   */
  async recordSale(vanLoadId: string, saleLines: SaleLineInput[], isIgst: boolean, placeOfSupply: string) {
    const vanLoad = await this.prisma.vanLoad.findUnique({
      where: { id: vanLoadId },
      include: { lines: { include: { batch: { include: { product: true } } } } },
    });
    if (!vanLoad) throw new BadRequestException('Van load not found');

    const invoiceInputLines = [];

    for (const sale of saleLines) {
      const line = vanLoad.lines.find((l: any) => l.id === sale.vanLoadLineId);
      if (!line) throw new BadRequestException(`Van load line ${sale.vanLoadLineId} not found on this load`);

      const alreadySold = new Decimal(line.soldQty.toString());
      const alreadyUnloaded = new Decimal(line.unloadedQty.toString());
      const remaining = new Decimal(line.loadedQty.toString()).minus(alreadySold).minus(alreadyUnloaded);

      if (remaining.lt(sale.quantity)) {
        throw new BadRequestException(
          `Only ${remaining.toString()} remaining on van for this line, cannot sell ${sale.quantity}`,
        );
      }

      await this.prisma.vanLoadLine.update({
        where: { id: line.id },
        data: { soldQty: { increment: sale.quantity.toString() } },
      });

      invoiceInputLines.push({
        batchId: line.batchId,
        productId: line.batch.productId,
        quantity: sale.quantity,
        rate: sale.rate,
        gstRatePercent: Number(line.batch.product.gstRatePercent),
      });
    }

    return this.invoiceService.generateVanDirectInvoice(invoiceInputLines, isIgst, placeOfSupply);
  }

  /**
   * End-of-day: unsold stock returns to the originating warehouse.
   * unloadedQty = loadedQty - soldQty (for each line still carrying stock).
   */
  async unloadVan(vanLoadId: string) {
    const vanLoad = await this.prisma.vanLoad.findUnique({
      where: { id: vanLoadId },
      include: { lines: { include: { batch: true } } },
    });
    if (!vanLoad) throw new BadRequestException('Van load not found');
    if (vanLoad.status === VanLoadStatus.UNLOADED) {
      throw new BadRequestException('Van load already unloaded');
    }

    await this.prisma.$transaction(async (tx: any) => {
      for (const line of vanLoad.lines) {
        const unsold = new Decimal(line.loadedQty.toString())
          .minus(line.soldQty.toString())
          .minus(line.unloadedQty.toString());

        if (unsold.gt(0)) {
          await tx.inventoryStock.upsert({
            where: {
              warehouseId_batchId: { warehouseId: vanLoad.warehouseId, batchId: line.batchId },
            },
            update: { quantityOnHand: { increment: unsold.toFixed(3) } },
            create: {
              warehouseId: vanLoad.warehouseId,
              batchId: line.batchId,
              productId: line.batch.productId,
              quantityOnHand: unsold.toFixed(3),
            },
          });

          await tx.vanLoadLine.update({
            where: { id: line.id },
            data: { unloadedQty: { increment: unsold.toFixed(3) } },
          });
        }
      }

      await tx.vanLoad.update({
        where: { id: vanLoadId },
        data: { status: VanLoadStatus.UNLOADED, unloadDate: new Date() },
      });
    });

    return this.prisma.vanLoad.findUnique({ where: { id: vanLoadId }, include: { lines: true } });
  }

  async findById(id: string) {
    return this.prisma.vanLoad.findUnique({
      where: { id },
      include: { lines: { include: { batch: true } } },
    });
  }
}

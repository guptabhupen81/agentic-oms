import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus, PicklistStatus } from '@prisma/client';
import Decimal from 'decimal.js';

@Injectable()
export class PicklistService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates picklist(s) for a set of orders. An order's allocations can in
   * principle span more than one warehouse (e.g. one line fulfilled from
   * warehouse A, another from warehouse B) — so this produces one Picklist
   * per warehouse involved, each containing only the lines that warehouse's
   * Incharge is responsible for.
   *
   * Idempotent-ish: allocations that already have a PicklistLine (from a
   * prior call) are skipped, so re-running this for an order that's partly
   * picklisted doesn't create duplicate picklist lines.
   */
  async generatePicklists(orderIds: string[]) {
    const allocations = await this.prisma.allocation.findMany({
      where: {
        orderLine: { orderId: { in: orderIds } },
        picklistLines: { none: {} }, // not already on a picklist
      },
      include: { batch: true, orderLine: true },
    });

    if (allocations.length === 0) {
      throw new BadRequestException(
        'No un-picklisted allocations found for these orders — has allocation run yet?',
      );
    }

    const byWarehouse = new Map<string, typeof allocations>();
    for (const alloc of allocations) {
      const list = byWarehouse.get(alloc.warehouseId) ?? [];
      list.push(alloc);
      byWarehouse.set(alloc.warehouseId, list);
    }

    const createdPicklists = [];

    for (const [warehouseId, allocs] of byWarehouse.entries()) {
      const picklistNumber = await this.generatePicklistNumber();
      const picklist = await this.prisma.picklist.create({
        data: {
          picklistNumber,
          warehouseId,
          status: PicklistStatus.PENDING,
          lines: {
            create: allocs.map((a: any) => ({
              allocationId: a.id,
              quantity: a.allocatedQty,
            })),
          },
        },
        include: { lines: { include: { allocation: { include: { batch: true } } } } },
      });
      createdPicklists.push(picklist);
    }

    await this.prisma.order.updateMany({
      where: { id: { in: orderIds } },
      data: { status: OrderStatus.PICKLIST_GENERATED },
    });

    return createdPicklists;
  }

  async assignToWarehouseIncharge(picklistId: string, userId: string) {
    return this.prisma.picklist.update({
      where: { id: picklistId },
      data: { assignedToId: userId, status: PicklistStatus.IN_PROGRESS },
    });
  }

  /** Warehouse Incharge records what was physically picked for a line (may be
   * less than requested, e.g. a shelf-count discrepancy). */
  async recordPick(picklistLineId: string, pickedQty: number) {
    return this.prisma.picklistLine.update({
      where: { id: picklistLineId },
      data: { pickedQty },
    });
  }

  /**
   * Completes a picklist: physically removes the picked quantity from
   * on-hand AND allocated stock (goods have left the shelf / are ready for
   * dispatch). Any shortfall between requested and picked quantity is left
   * as a flagged discrepancy (allocatedQty stays reserved) rather than
   * silently resolved — a real shortfall needs a human decision
   * (re-allocate, backorder, or write off).
   */
  async completePicklist(picklistId: string) {
    const picklist = await this.prisma.picklist.findUnique({
      where: { id: picklistId },
      include: { lines: { include: { allocation: true } } },
    });
    if (!picklist) throw new BadRequestException('Picklist not found');

    const discrepancies: { picklistLineId: string; requested: string; picked: string }[] = [];

    await this.prisma.$transaction(async (tx: any) => {
      for (const line of picklist.lines) {
        const pickedQty = new Decimal(line.pickedQty.toString());
        const requestedQty = new Decimal(line.quantity.toString());

        if (!pickedQty.eq(requestedQty)) {
          discrepancies.push({
            picklistLineId: line.id,
            requested: requestedQty.toFixed(3),
            picked: pickedQty.toFixed(3),
          });
        }

        await tx.inventoryStock.update({
          where: {
            warehouseId_batchId: {
              warehouseId: picklist.warehouseId,
              batchId: line.allocation.batchId,
            },
          },
          data: {
            quantityOnHand: { decrement: pickedQty.toFixed(3) },
            quantityAllocated: { decrement: pickedQty.toFixed(3) },
          },
        });
      }

      await tx.picklist.update({
        where: { id: picklistId },
        data: { status: PicklistStatus.COMPLETED },
      });
    });

    return { picklistId, status: PicklistStatus.COMPLETED, discrepancies };
  }

  async findById(id: string) {
    return this.prisma.picklist.findUnique({
      where: { id },
      include: { lines: { include: { allocation: { include: { batch: true, orderLine: true } } } } },
    });
  }

  private async generatePicklistNumber(): Promise<string> {
    const count = await this.prisma.picklist.count();
    const year = new Date().getFullYear();
    return `PICK-${year}-${String(count + 1).padStart(6, '0')}`;
  }
}

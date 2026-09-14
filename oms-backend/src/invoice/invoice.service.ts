import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import Decimal from 'decimal.js';

interface RateOverride {
  productId: string;
  rate: number; // unit price, ex-tax — overrides the product's list price for this invoice only
}

@Injectable()
export class InvoiceService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates an India-standard GST invoice from an allocated order.
   * Tax split rule: if the retailer's state differs from the supplying
   * warehouse's state -> IGST; otherwise CGST+SGST (split equally). State is
   * simplified here to a field on placeOfSupply for the showcase; a production
   * version would resolve it from registered addresses/GSTIN state codes.
   *
   * Pricing uses the product's list price by default (same source the order
   * value preview and credit-limit check use), with per-line discount,
   * free-item, and the order's overall discount all applied — so what a
   * customer sees previewed on the order is exactly what they're invoiced.
   * `rateOverrides` lets a specific invoice use a negotiated rate instead of
   * list price, if ever needed; ordinary flow doesn't need to pass any.
   */
  async generateInvoiceForOrder(
    orderId: string,
    isIgst: boolean,
    placeOfSupply: string,
    rateOverrides: RateOverride[] = [],
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        lines: { include: { allocations: { include: { batch: true } }, product: true } },
      },
    });
    if (!order) throw new BadRequestException('Order not found');

    const overrideMap = new Map(rateOverrides.map((r) => [r.productId, r.rate]));
    const overallScale = new Decimal(1).minus(new Decimal(order.overallDiscountPercent.toString()).div(100));

    let subTotal = new Decimal(0);
    let totalTax = new Decimal(0);
    const invoiceLinesData: any[] = [];

    for (const line of order.lines) {
      const listPrice = overrideMap.get(line.productId) ?? Number(line.product.defaultUnitPrice);
      const gstRate = new Decimal(line.product.gstRatePercent.toString()).div(100);

      // Per-unit price after line discount + overall discount — applying this
      // per unit means it distributes correctly across however many batches
      // this line's allocation ended up split across.
      const discountPercent = new Decimal(line.discountPercent.toString());
      const effectiveUnitPrice = line.isFreeItem
        ? new Decimal(0)
        : new Decimal(listPrice).mul(new Decimal(1).minus(discountPercent.div(100))).mul(overallScale);

      // One invoice line per batch allocation, so the invoice itself shows
      // exactly which batch (and therefore expiry) the customer received —
      // required for traceability in FMCG distribution.
      for (const alloc of line.allocations) {
        const qty = new Decimal(alloc.allocatedQty.toString());
        const taxableValue = qty.mul(effectiveUnitPrice);
        const taxAmount = taxableValue.mul(gstRate);

        const cgst = isIgst ? new Decimal(0) : taxAmount.div(2);
        const sgst = isIgst ? new Decimal(0) : taxAmount.div(2);
        const igst = isIgst ? taxAmount : new Decimal(0);

        subTotal = subTotal.plus(taxableValue);
        totalTax = totalTax.plus(taxAmount);

        invoiceLinesData.push({
          orderLineId: line.id,
          batchId: alloc.batchId,
          quantity: qty.toFixed(3),
          rate: effectiveUnitPrice.toFixed(2),
          taxableValue: taxableValue.toFixed(2),
          cgstAmount: cgst.toFixed(2),
          sgstAmount: sgst.toFixed(2),
          igstAmount: igst.toFixed(2),
        });
      }
    }

    const totalAmount = subTotal.plus(totalTax);
    const invoiceNumber = await this.generateInvoiceNumber();

    const invoice = await this.prisma.invoice.create({
      data: {
        invoiceNumber,
        orderId: order.id,
        placeOfSupply,
        isIgst,
        subTotal: subTotal.toFixed(2),
        totalTax: totalTax.toFixed(2),
        totalAmount: totalAmount.toFixed(2),
        lines: { create: invoiceLinesData },
      },
      include: { lines: true },
    });

    await this.prisma.order.update({
      where: { id: order.id },
      data: { status: 'INVOICED' },
    });

    return invoice;
  }

  /** Van direct sale: no prior Order — invoice created straight from van-load lines. */
  async generateVanDirectInvoice(
    vanLoadLines: { batchId: string; productId: string; quantity: number; rate: number; gstRatePercent: number }[],
    isIgst: boolean,
    placeOfSupply: string,
  ) {
    let subTotal = new Decimal(0);
    let totalTax = new Decimal(0);
    const invoiceLinesData: any[] = [];

    for (const l of vanLoadLines) {
      const qty = new Decimal(l.quantity);
      const taxableValue = qty.mul(l.rate);
      const taxAmount = taxableValue.mul(new Decimal(l.gstRatePercent).div(100));
      const cgst = isIgst ? new Decimal(0) : taxAmount.div(2);
      const sgst = isIgst ? new Decimal(0) : taxAmount.div(2);
      const igst = isIgst ? taxAmount : new Decimal(0);

      subTotal = subTotal.plus(taxableValue);
      totalTax = totalTax.plus(taxAmount);

      invoiceLinesData.push({
        batchId: l.batchId,
        quantity: qty.toFixed(3),
        rate: l.rate.toFixed ? l.rate.toFixed(2) : String(l.rate),
        taxableValue: taxableValue.toFixed(2),
        cgstAmount: cgst.toFixed(2),
        sgstAmount: sgst.toFixed(2),
        igstAmount: igst.toFixed(2),
      });
    }

    const totalAmount = subTotal.plus(totalTax);
    const invoiceNumber = await this.generateInvoiceNumber();

    return this.prisma.invoice.create({
      data: {
        invoiceNumber,
        orderId: null,
        placeOfSupply,
        isIgst,
        subTotal: subTotal.toFixed(2),
        totalTax: totalTax.toFixed(2),
        totalAmount: totalAmount.toFixed(2),
        lines: { create: invoiceLinesData },
      },
      include: { lines: true },
    });
  }

  private async generateInvoiceNumber(): Promise<string> {
    const count = await this.prisma.invoice.count();
    const year = new Date().getFullYear();
    return `INV-${year}-${String(count + 1).padStart(6, '0')}`;
  }
}

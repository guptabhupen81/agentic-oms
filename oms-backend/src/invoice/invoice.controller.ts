import { Body, Controller, Post } from '@nestjs/common';
import { InvoiceService } from './invoice.service';

@Controller('invoices')
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Post('from-order')
  fromOrder(
    @Body()
    body: {
      orderId: string;
      isIgst: boolean;
      placeOfSupply: string;
      priceList: { productId: string; rate: number }[];
    },
  ) {
    return this.invoiceService.generateInvoiceForOrder(
      body.orderId,
      body.isIgst,
      body.placeOfSupply,
      body.priceList,
    );
  }

  @Post('van-direct')
  vanDirect(
    @Body()
    body: {
      lines: { batchId: string; productId: string; quantity: number; rate: number; gstRatePercent: number }[];
      isIgst: boolean;
      placeOfSupply: string;
    },
  ) {
    return this.invoiceService.generateVanDirectInvoice(body.lines, body.isIgst, body.placeOfSupply);
  }
}

import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { InventoryService } from './inventory.service';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  getAllStock() {
    return this.inventoryService.getAllStock();
  }

  @Get('warehouse/:warehouseId/summary')
  getWarehouseStockSummary(@Param('warehouseId') warehouseId: string) {
    return this.inventoryService.getWarehouseStockSummary(warehouseId);
  }

  @Get('warehouse/:warehouseId')
  getWarehouseStock(@Param('warehouseId') warehouseId: string) {
    return this.inventoryService.getWarehouseStock(warehouseId);
  }

  @Post('adjust')
  adjust(
    @Body()
    body: { warehouseId: string; batchId: string; delta: number; reason: string },
  ) {
    return this.inventoryService.adjustStock(body.warehouseId, body.batchId, body.delta, body.reason);
  }

  @Post('transfer')
  createTransfer(
    @Body()
    body: {
      fromWarehouseId: string;
      toWarehouseId?: string;
      lines: { batchId: string; quantity: number }[];
    },
  ) {
    return this.inventoryService.createTransfer(
      body.fromWarehouseId,
      body.toWarehouseId ?? null,
      body.lines,
    );
  }

  @Post('transfer/:id/complete')
  completeTransfer(@Param('id') id: string) {
    return this.inventoryService.completeTransfer(id);
  }
}

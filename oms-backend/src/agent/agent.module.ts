import { Module } from '@nestjs/common';
import { AgentService } from './agent.service';
import { AgentController } from './agent.controller';
import { PurchaseModule } from '../purchase/purchase.module';
import { InventoryModule } from '../inventory/inventory.module';
import { AllocationModule } from '../allocation/allocation.module';

@Module({
  imports: [PurchaseModule, InventoryModule, AllocationModule],
  controllers: [AgentController],
  providers: [AgentService],
})
export class AgentModule {}

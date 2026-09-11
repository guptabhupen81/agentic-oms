import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { ProductModule } from './product/product.module';
import { InventoryModule } from './inventory/inventory.module';
import { OrderModule } from './order/order.module';
import { AllocationModule } from './allocation/allocation.module';
import { InvoiceModule } from './invoice/invoice.module';
import { PurchaseModule } from './purchase/purchase.module';
import { PicklistModule } from './picklist/picklist.module';
import { VanModule } from './van/van.module';
import { AuthModule } from './auth/auth.module';
import { AgentModule } from './agent/agent.module';
import { AgentTaskModule } from './agent-task/agent-task.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    ProductModule,
    InventoryModule,
    OrderModule,
    AllocationModule,
    InvoiceModule,
    PurchaseModule,
    PicklistModule,
    VanModule,
    AgentModule,
    AgentTaskModule,
  ],
})
export class AppModule {}

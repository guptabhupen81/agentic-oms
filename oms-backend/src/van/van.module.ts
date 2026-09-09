import { Module } from '@nestjs/common';
import { VanService } from './van.service';
import { VanController } from './van.controller';
import { InvoiceModule } from '../invoice/invoice.module';

@Module({
  imports: [InvoiceModule],
  controllers: [VanController],
  providers: [VanService],
  exports: [VanService],
})
export class VanModule {}

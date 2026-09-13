import { Module } from '@nestjs/common';
import { RetailerService } from './retailer.service';
import { RetailerController } from './retailer.controller';
import { WarehouseService } from './warehouse.service';
import { WarehouseController } from './warehouse.controller';
import { VanMasterService } from './van-master.service';
import { VanMasterController } from './van-master.controller';
import { ManufacturerController } from './manufacturer.controller';

@Module({
  controllers: [RetailerController, WarehouseController, VanMasterController, ManufacturerController],
  providers: [RetailerService, WarehouseService, VanMasterService],
  exports: [RetailerService, WarehouseService, VanMasterService],
})
export class MastersModule {}

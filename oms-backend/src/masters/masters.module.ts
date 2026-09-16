import { Module } from '@nestjs/common';
import { RetailerService } from './retailer.service';
import { RetailerController } from './retailer.controller';
import { WarehouseService } from './warehouse.service';
import { WarehouseController } from './warehouse.controller';
import { VanMasterService } from './van-master.service';
import { VanMasterController } from './van-master.controller';
import { TruckMasterService } from './truck-master.service';
import { TruckMasterController } from './truck-master.controller';
import { ManufacturerController } from './manufacturer.controller';

@Module({
  controllers: [
    RetailerController,
    WarehouseController,
    VanMasterController,
    TruckMasterController,
    ManufacturerController,
  ],
  providers: [RetailerService, WarehouseService, VanMasterService, TruckMasterService],
  exports: [RetailerService, WarehouseService, VanMasterService, TruckMasterService],
})
export class MastersModule {}

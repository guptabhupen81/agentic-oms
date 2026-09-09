import { Module } from '@nestjs/common';
import { PicklistService } from './picklist.service';
import { PicklistController } from './picklist.controller';

@Module({
  controllers: [PicklistController],
  providers: [PicklistService],
  exports: [PicklistService],
})
export class PicklistModule {}

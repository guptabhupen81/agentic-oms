import { Module } from '@nestjs/common';
import { ChannelHierarchyService } from './channel-hierarchy.service';
import { ChannelHierarchyController } from './channel-hierarchy.controller';

@Module({
  controllers: [ChannelHierarchyController],
  providers: [ChannelHierarchyService],
  exports: [ChannelHierarchyService],
})
export class ChannelHierarchyModule {}

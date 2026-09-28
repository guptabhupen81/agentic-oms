import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ChannelHierarchyService } from './channel-hierarchy.service';

@Controller('channel-hierarchy')
export class ChannelHierarchyController {
  constructor(private readonly channelHierarchyService: ChannelHierarchyService) {}

  @Get()
  getTree() {
    return this.channelHierarchyService.getTree();
  }

  @Post()
  createNode(@Body() body: { name: string; parentId?: string }) {
    return this.channelHierarchyService.createNode(body);
  }

  @Patch(':id')
  updateNode(@Param('id') id: string, @Body() body: { name: string }) {
    return this.channelHierarchyService.updateNode(id, body);
  }

  @Delete(':id')
  deleteNode(@Param('id') id: string) {
    return this.channelHierarchyService.deleteNode(id);
  }
}

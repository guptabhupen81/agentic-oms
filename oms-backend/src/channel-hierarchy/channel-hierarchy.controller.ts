import { UserRole } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ChannelHierarchyService } from './channel-hierarchy.service';

@Controller('channel-hierarchy')
export class ChannelHierarchyController {
  constructor(private readonly channelHierarchyService: ChannelHierarchyService) {}

  @Get()
  getTree() {
    return this.channelHierarchyService.getTree();
  }

  @Roles(UserRole.MDM_ADMIN)
  @Post()
  createNode(@Body() body: { name: string; parentId?: string }) {
    return this.channelHierarchyService.createNode(body);
  }

  @Roles(UserRole.MDM_ADMIN)
  @Patch(':id')
  updateNode(@Param('id') id: string, @Body() body: { name: string }) {
    return this.channelHierarchyService.updateNode(id, body);
  }

  @Roles(UserRole.MDM_ADMIN)
  @Delete(':id')
  deleteNode(@Param('id') id: string) {
    return this.channelHierarchyService.deleteNode(id);
  }
}

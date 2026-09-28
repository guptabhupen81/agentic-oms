import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChannelHierarchyService {
  constructor(private readonly prisma: PrismaService) {}

  /** Full 2-level tree in one call, same pattern as the Product hierarchy. */
  async getTree() {
    const nodes = await this.prisma.channelHierarchyNode.findMany({ orderBy: { level: 'asc' } });
    type NodeWithChildren = (typeof nodes)[number] & { children: NodeWithChildren[] };
    const byId = new Map<string, NodeWithChildren>(nodes.map((n: any) => [n.id, { ...n, children: [] }]));
    const roots: NodeWithChildren[] = [];
    for (const node of byId.values()) {
      if (node.parentId && byId.has(node.parentId)) {
        byId.get(node.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }
    return roots;
  }

  /**
   * Creates a node. No parentId => Level 1 (top). A parentId is only valid
   * if it points at a Level-1 node — the hierarchy is exactly 2 levels deep,
   * so a Level-2 node can never itself become a parent.
   */
  async createNode(data: { name: string; parentId?: string }) {
    if (!data.parentId) {
      return this.prisma.channelHierarchyNode.create({ data: { name: data.name, level: 1 } });
    }
    const parent = await this.prisma.channelHierarchyNode.findUnique({ where: { id: data.parentId } });
    if (!parent) throw new BadRequestException('Parent node not found');
    if (parent.level !== 1) {
      throw new BadRequestException('Channel hierarchy supports exactly 2 levels — parent must be a Level-1 node');
    }
    return this.prisma.channelHierarchyNode.create({
      data: { name: data.name, parentId: data.parentId, level: 2 },
    });
  }

  /** Rename only — level and parent are immutable, which is what keeps the
   * "exactly 2 levels" invariant simple to guarantee. */
  async updateNode(id: string, data: { name: string }) {
    const node = await this.prisma.channelHierarchyNode.findUnique({ where: { id } });
    if (!node) throw new BadRequestException('Node not found');
    return this.prisma.channelHierarchyNode.update({ where: { id }, data: { name: data.name } });
  }

  async deleteNode(id: string) {
    const childCount = await this.prisma.channelHierarchyNode.count({ where: { parentId: id } });
    if (childCount > 0) {
      throw new BadRequestException('Cannot delete a Level-1 node that has child nodes — remove them first');
    }
    const retailerCount = await this.prisma.retailer.count({ where: { channelNodeId: id } });
    if (retailerCount > 0) {
      throw new BadRequestException('Cannot delete a node that has retailers mapped to it');
    }
    return this.prisma.channelHierarchyNode.delete({ where: { id } });
  }
}

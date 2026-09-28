import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProductService {
  constructor(private readonly prisma: PrismaService) {}

  /** Returns the full hierarchy tree (all levels) in one call — mobile downloads
   * this once as part of "master sync" rather than paging level by level. */
  async getHierarchyTree() {
    const nodes = await this.prisma.productHierarchyNode.findMany({
      orderBy: { level: 'asc' },
    });
    type NodeWithChildren = (typeof nodes)[number] & { children: NodeWithChildren[] };
    const byId = new Map<string, NodeWithChildren>(
      nodes.map((n: any) => [n.id, { ...n, children: [] }]),
    );
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
   * Creates a hierarchy node. Level is always derived from the parent
   * (root nodes are level 1) so the tree can never get an inconsistent
   * level recorded by a caller.
   */
  async createHierarchyNode(data: { name: string; parentId?: string }) {
    let level = 1;
    if (data.parentId) {
      const parent = await this.prisma.productHierarchyNode.findUnique({ where: { id: data.parentId } });
      if (!parent) throw new BadRequestException('Parent node not found');
      level = parent.level + 1;
    }
    return this.prisma.productHierarchyNode.create({
      data: { name: data.name, parentId: data.parentId, level },
    });
  }

  /**
   * Updates a node's name and/or re-parents it. Re-parenting recomputes the
   * level of the node AND every descendant underneath it (in a transaction)
   * so the tree's levels stay correct after a move, not just the one node.
   */
  async updateHierarchyNode(id: string, data: { name?: string; parentId?: string | null }) {
    const node = await this.prisma.productHierarchyNode.findUnique({ where: { id } });
    if (!node) throw new BadRequestException('Node not found');

    if (data.parentId === undefined) {
      // Rename only — level/parent untouched.
      return this.prisma.productHierarchyNode.update({ where: { id }, data: { name: data.name } });
    }

    let newLevel = 1;
    if (data.parentId) {
      if (data.parentId === id) throw new BadRequestException('A node cannot be its own parent');
      const parent = await this.prisma.productHierarchyNode.findUnique({ where: { id: data.parentId } });
      if (!parent) throw new BadRequestException('Parent node not found');

      // Reject cycles: the new parent must not be a descendant of this node.
      let cursor: { id: string; parentId: string | null } | null = parent;
      while (cursor) {
        if (cursor.id === id) {
          throw new BadRequestException('Cannot move a node under its own descendant');
        }
        cursor = cursor.parentId
          ? await this.prisma.productHierarchyNode.findUnique({ where: { id: cursor.parentId } })
          : null;
      }
      newLevel = parent.level + 1;
    }

    return this.prisma.$transaction(async (tx: any) => {
      const updated = await tx.productHierarchyNode.update({
        where: { id },
        data: { name: data.name, parentId: data.parentId, level: newLevel },
      });
      await this.recomputeDescendantLevels(tx, id, newLevel);
      return updated;
    });
  }

  async deleteHierarchyNode(id: string) {
    const childCount = await this.prisma.productHierarchyNode.count({ where: { parentId: id } });
    if (childCount > 0) {
      throw new BadRequestException('Cannot delete a node that has child nodes — remove or move them first');
    }
    const productCount = await this.prisma.product.count({ where: { hierarchyNodeId: id } });
    if (productCount > 0) {
      throw new BadRequestException('Cannot delete a node that has products attached to it');
    }
    return this.prisma.productHierarchyNode.delete({ where: { id } });
  }

  private async recomputeDescendantLevels(tx: any, nodeId: string, nodeLevel: number): Promise<void> {
    const children = await tx.productHierarchyNode.findMany({ where: { parentId: nodeId } });
    for (const child of children) {
      const childLevel = nodeLevel + 1;
      await tx.productHierarchyNode.update({ where: { id: child.id }, data: { level: childLevel } });
      await this.recomputeDescendantLevels(tx, child.id, childLevel);
    }
  }

  async listProducts(activeOnly = true, search?: string) {
    return this.prisma.product.findMany({
      where: {
        ...(activeOnly ? { isActive: true } : {}),
        ...(search
          ? {
              OR: [
                { sku: { contains: search, mode: 'insensitive' } },
                { name: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: { hierarchyNode: true, manufacturer: true },
      ...(search ? { take: 20 } : {}),
    });
  }

  /** Delta sync: mobile passes the last sync timestamp, gets only what changed. */
  async listProductsUpdatedSince(since: Date) {
    return this.prisma.product.findMany({
      where: { createdAt: { gte: since } },
    });
  }

  async findById(id: string) {
    return this.prisma.product.findUnique({
      where: { id },
      include: { hierarchyNode: true, manufacturer: true },
    });
  }

  async create(data: {
    sku: string;
    name: string;
    hierarchyNodeId: string;
    manufacturerId: string;
    uom: string;
    hsnCode?: string;
    gstRatePercent?: number;
    defaultUnitPrice?: number;
    minOrderQty?: number;
    maxOrderQty?: number;
    primaryMoq?: number;
    caseQty?: number;
    unitWeightKg?: number;
    unitVolumeCbm?: number;
  }) {
    return this.prisma.product.create({ data });
  }

  async update(id: string, data: Partial<Parameters<ProductService['create']>[0]>) {
    return this.prisma.product.update({ where: { id }, data });
  }

  async setActive(id: string, isActive: boolean) {
    return this.prisma.product.update({ where: { id }, data: { isActive } });
  }
}

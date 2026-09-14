import { Injectable } from '@nestjs/common';
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

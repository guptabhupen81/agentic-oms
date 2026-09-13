import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface WarehouseInput {
  name: string;
  code: string;
  address?: string;
}

@Injectable()
export class WarehouseService {
  constructor(private readonly prisma: PrismaService) {}

  async list(activeOnly = true) {
    return this.prisma.warehouse.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string) {
    return this.prisma.warehouse.findUnique({ where: { id } });
  }

  async create(data: WarehouseInput) {
    return this.prisma.warehouse.create({ data });
  }

  async update(id: string, data: Partial<WarehouseInput>) {
    return this.prisma.warehouse.update({ where: { id }, data });
  }

  async setActive(id: string, isActive: boolean) {
    return this.prisma.warehouse.update({ where: { id }, data: { isActive } });
  }
}

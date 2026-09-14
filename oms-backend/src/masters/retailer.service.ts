import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface RetailerInput {
  code: string;
  name: string;
  gstin?: string;
  address?: string;
  creditLimitAmount?: number;
}

@Injectable()
export class RetailerService {
  constructor(private readonly prisma: PrismaService) {}

  async list(activeOnly = true) {
    return this.prisma.retailer.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string) {
    return this.prisma.retailer.findUnique({ where: { id } });
  }

  async create(data: RetailerInput) {
    return this.prisma.retailer.create({ data });
  }

  async update(id: string, data: Partial<RetailerInput>) {
    return this.prisma.retailer.update({ where: { id }, data });
  }

  async setActive(id: string, isActive: boolean) {
    return this.prisma.retailer.update({ where: { id }, data: { isActive } });
  }
}

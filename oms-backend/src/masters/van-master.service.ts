import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface VanInput {
  registration: string;
  name: string;
}

@Injectable()
export class VanMasterService {
  constructor(private readonly prisma: PrismaService) {}

  async list(activeOnly = true) {
    return this.prisma.van.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string) {
    return this.prisma.van.findUnique({ where: { id } });
  }

  async create(data: VanInput) {
    return this.prisma.van.create({ data });
  }

  async update(id: string, data: Partial<VanInput>) {
    return this.prisma.van.update({ where: { id }, data });
  }

  async setActive(id: string, isActive: boolean) {
    return this.prisma.van.update({ where: { id }, data: { isActive } });
  }
}

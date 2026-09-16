import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface TruckInput {
  registration: string;
  name: string;
  capacityWeightKg?: number;
  capacityVolumeCbm?: number;
}

@Injectable()
export class TruckMasterService {
  constructor(private readonly prisma: PrismaService) {}

  async list(activeOnly = true) {
    return this.prisma.truck.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string) {
    return this.prisma.truck.findUnique({ where: { id } });
  }

  async create(data: TruckInput) {
    return this.prisma.truck.create({ data });
  }

  async update(id: string, data: Partial<TruckInput>) {
    return this.prisma.truck.update({ where: { id }, data });
  }

  async setActive(id: string, isActive: boolean) {
    return this.prisma.truck.update({ where: { id }, data: { isActive } });
  }
}

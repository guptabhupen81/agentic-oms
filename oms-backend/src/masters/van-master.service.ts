import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertInScope } from '../common/scope.util';

export interface VanInput {
  registration: string;
  name: string;
}

@Injectable()
export class VanMasterService {
  constructor(private readonly prisma: PrismaService) {}

  async list(activeOnly = true, scope?: string) {
    return this.prisma.van.findMany({
      where: { ...(activeOnly ? { isActive: true } : {}), ...(scope ? { distributorId: scope } : {}) },
      include: { assignedSalesman: true },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string, scope?: string) {
    const van = await this.prisma.van.findUnique({ where: { id }, include: { assignedSalesman: true } });
    if (van) assertInScope(van.distributorId, scope, 'Van');
    return van;
  }

  private async assertOwned(id: string, scope?: string) {
    const van = await this.prisma.van.findUnique({ where: { id } });
    if (!van) throw new NotFoundException('Van not found');
    assertInScope(van.distributorId, scope, 'Van');
  }

  async create(data: VanInput, scope?: string) {
    if (!scope) throw new BadRequestException('A van must be created under a distributor');
    return this.prisma.van.create({ data: { ...data, distributorId: scope } });
  }

  async update(id: string, data: Partial<VanInput>, scope?: string) {
    await this.assertOwned(id, scope);
    return this.prisma.van.update({ where: { id }, data });
  }

  async setActive(id: string, isActive: boolean, scope?: string) {
    await this.assertOwned(id, scope);
    return this.prisma.van.update({ where: { id }, data: { isActive } });
  }
}

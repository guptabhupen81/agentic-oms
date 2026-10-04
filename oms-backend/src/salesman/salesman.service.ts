import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { assertInScope } from '../common/scope.util';
import { PrismaService } from '../prisma/prisma.service';
import { SellerType } from '@prisma/client';

export interface SalesmanInput {
  code: string;
  name: string;
  phone?: string;
  sellerType: SellerType;
}

@Injectable()
export class SalesmanService {
  constructor(private readonly prisma: PrismaService) {}

  async list(activeOnly = true, scope?: string) {
    return this.prisma.salesman.findMany({
      where: { ...(activeOnly ? { isActive: true } : {}), ...(scope ? { distributorId: scope } : {}) },
      include: { van: true },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string, scope?: string) {
    const salesman = await this.prisma.salesman.findUnique({
      where: { id },
      include: { van: true, retailerMappings: { include: { retailer: true } } },
    });
    if (salesman) assertInScope(salesman.distributorId, scope, 'Salesman');
    return salesman;
  }

  private async assertOwnedSalesman(id: string, scope?: string) {
    const salesman = await this.prisma.salesman.findUnique({ where: { id } });
    if (!salesman) throw new NotFoundException('Salesman not found');
    assertInScope(salesman.distributorId, scope, 'Salesman');
    return salesman;
  }

  async create(data: SalesmanInput, scope?: string) {
    if (!scope) throw new BadRequestException('A salesman must be created under a distributor');
    return this.prisma.salesman.create({ data: { ...data, distributorId: scope } });
  }

  async update(id: string, data: Partial<SalesmanInput>, scope?: string) {
    await this.assertOwnedSalesman(id, scope);
    return this.prisma.salesman.update({ where: { id }, data });
  }

  async setActive(id: string, isActive: boolean, scope?: string) {
    await this.assertOwnedSalesman(id, scope);
    return this.prisma.salesman.update({ where: { id }, data: { isActive } });
  }

  // -------------------------------------------------------------------
  // Retailer <-> Salesman mapping
  //
  // Rules (as specified):
  //  - A retailer may have BOTH a Pre-Seller and a Delivery Boy mapped.
  //  - A retailer mapped to a Pre-Seller cannot also get a Van-Seller.
  //  - A retailer mapped to a Van-Seller cannot also get a Pre-Seller or
  //    Delivery Boy — a Van-Seller mapping is exclusive, in both directions.
  //  - At most one active salesman of a given sellerType per retailer (a
  //    retailer doesn't get two Pre-Sellers at once).
  // -------------------------------------------------------------------

  async listMappingsForRetailer(retailerId: string, scope?: string) {
    const retailer = await this.prisma.retailer.findUnique({ where: { id: retailerId } });
    if (!retailer) throw new NotFoundException('Retailer not found');
    assertInScope(retailer.distributorId, scope, 'Retailer');
    return this.prisma.retailerSalesmanMapping.findMany({
      where: { retailerId },
      include: { salesman: true },
    });
  }

  async mapToRetailer(retailerId: string, salesmanId: string, scope?: string) {
    const [retailer, salesman] = await Promise.all([
      this.prisma.retailer.findUnique({ where: { id: retailerId } }),
      this.prisma.salesman.findUnique({ where: { id: salesmanId } }),
    ]);
    if (!retailer) throw new BadRequestException('Retailer not found');
    if (!salesman) throw new BadRequestException('Salesman not found');
    assertInScope(retailer.distributorId, scope, 'Retailer');
    assertInScope(salesman.distributorId, scope, 'Salesman');
    // Always enforced (even for an unscoped caller): a retailer can only be served
    // by a salesman of the same distributor.
    if (retailer.distributorId !== salesman.distributorId) {
      throw new BadRequestException('Retailer and salesman belong to different distributors');
    }

    const existingMappings = await this.prisma.retailerSalesmanMapping.findMany({
      where: { retailerId },
      include: { salesman: true },
    });
    const existingTypes = new Set(existingMappings.map((m: any) => m.salesman.sellerType));

    if (salesman.sellerType === SellerType.VAN_SELLER) {
      if (existingTypes.size > 0) {
        throw new BadRequestException(
          'Van-Seller mapping is exclusive — this retailer already has another seller mapped',
        );
      }
    } else {
      if (existingTypes.has(SellerType.VAN_SELLER)) {
        throw new BadRequestException(
          'This retailer is mapped to a Van-Seller — Van-Seller mapping is exclusive, unmap it first',
        );
      }
      if (existingTypes.has(salesman.sellerType)) {
        throw new BadRequestException(
          `This retailer already has a ${salesman.sellerType} mapped — unmap the existing one first`,
        );
      }
    }

    return this.prisma.retailerSalesmanMapping.create({
      data: { retailerId, salesmanId },
      include: { salesman: true, retailer: true },
    });
  }

  async unmapFromRetailer(mappingId: string, scope?: string) {
    const mapping = await this.prisma.retailerSalesmanMapping.findUnique({ where: { id: mappingId }, include: { retailer: true } });
    if (!mapping) throw new NotFoundException('Mapping not found');
    assertInScope(mapping.retailer.distributorId, scope, 'Mapping');
    return this.prisma.retailerSalesmanMapping.delete({ where: { id: mappingId } });
  }

  // -------------------------------------------------------------------
  // Salesman <-> Van mapping
  //
  // Rules: only a Van-Seller or Delivery Boy may be mapped to a van; one van
  // holds one salesman at a time (enforced by the unique FK on Van in the
  // schema, which also means a salesman can back at most one van at a time).
  // -------------------------------------------------------------------

  async assignVan(salesmanId: string, vanId: string, scope?: string) {
    const salesman = await this.prisma.salesman.findUnique({ where: { id: salesmanId } });
    if (!salesman) throw new BadRequestException('Salesman not found');
    if (salesman.sellerType === SellerType.PRE_SELLER) {
      throw new BadRequestException('Only a Van-Seller or Delivery Boy salesman can be mapped to a van');
    }

    const van = await this.prisma.van.findUnique({ where: { id: vanId } });
    if (!van) throw new BadRequestException('Van not found');
    assertInScope(salesman.distributorId, scope, 'Salesman');
    assertInScope(van.distributorId, scope, 'Van');
    if (van.distributorId !== salesman.distributorId) {
      throw new BadRequestException('Salesman and van belong to different distributors');
    }
    if (van.assignedSalesmanId && van.assignedSalesmanId !== salesmanId) {
      throw new BadRequestException('This van already has a salesman mapped — unassign it first');
    }

    return this.prisma.van.update({
      where: { id: vanId },
      data: { assignedSalesmanId: salesmanId },
      include: { assignedSalesman: true },
    });
  }

  async unassignVan(vanId: string, scope?: string) {
    const van = await this.prisma.van.findUnique({ where: { id: vanId } });
    if (!van) throw new NotFoundException('Van not found');
    assertInScope(van.distributorId, scope, 'Van');
    return this.prisma.van.update({
      where: { id: vanId },
      data: { assignedSalesmanId: null },
    });
  }
}

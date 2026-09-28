import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { isValidGstin } from '../common/gstin.util';
import { lookupPincode } from '../common/pincode.util';

export interface RetailerInput {
  code: string;
  name: string;
  gstin?: string;
  pinCode?: string;
  address?: string;
  creditLimitAmount?: number;
  channelNodeId?: string;
}

@Injectable()
export class RetailerService {
  constructor(private readonly prisma: PrismaService) {}

  async list(activeOnly = true) {
    return this.prisma.retailer.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      include: { channelNode: true },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string) {
    return this.prisma.retailer.findUnique({ where: { id }, include: { channelNode: true } });
  }

  /** Exposed standalone so the frontend can preview City/State as the user
   * types a PIN code, before the retailer is saved. */
  async lookupPincode(pinCode: string) {
    return lookupPincode(pinCode);
  }

  async create(data: RetailerInput) {
    const derived = await this.prepareGeoAndValidate(data);
    return this.prisma.retailer.create({
      data: {
        code: data.code,
        name: data.name,
        gstin: derived.gstin,
        pinCode: derived.pinCode,
        city: derived.city,
        state: derived.state,
        address: data.address,
        creditLimitAmount: data.creditLimitAmount,
        channelNodeId: derived.channelNodeId,
      },
    });
  }

  async update(id: string, data: Partial<RetailerInput>) {
    const derived = await this.prepareGeoAndValidate(data);
    return this.prisma.retailer.update({
      where: { id },
      data: {
        ...(data.code !== undefined ? { code: data.code } : {}),
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.gstin !== undefined ? { gstin: derived.gstin } : {}),
        ...(data.pinCode !== undefined
          ? { pinCode: derived.pinCode, city: derived.city, state: derived.state }
          : {}),
        ...(data.address !== undefined ? { address: data.address } : {}),
        ...(data.creditLimitAmount !== undefined ? { creditLimitAmount: data.creditLimitAmount } : {}),
        ...(data.channelNodeId !== undefined ? { channelNodeId: derived.channelNodeId } : {}),
      },
    });
  }

  async setActive(id: string, isActive: boolean) {
    return this.prisma.retailer.update({ where: { id }, data: { isActive } });
  }

  /**
   * Validates GSTIN (format + checksum) when provided, auto-derives
   * City/State from a PIN code when provided (PIN code is always the source
   * of truth for city/state — the client cannot override it directly), and
   * validates a channelNodeId, if given, points at a Level-2 channel node.
   */
  private async prepareGeoAndValidate(data: Partial<RetailerInput>): Promise<{
    gstin: string | null | undefined;
    pinCode: string | null | undefined;
    city: string | null | undefined;
    state: string | null | undefined;
    channelNodeId: string | null | undefined;
  }> {
    let gstin: string | null | undefined = undefined;
    if (data.gstin !== undefined) {
      if (!data.gstin) {
        gstin = null;
      } else {
        const normalized = data.gstin.trim().toUpperCase();
        if (!isValidGstin(normalized)) {
          throw new BadRequestException(`Invalid GSTIN: ${data.gstin} (fails format/checksum validation)`);
        }
        gstin = normalized;
      }
    }

    let pinCode: string | null | undefined = undefined;
    let city: string | null | undefined = undefined;
    let state: string | null | undefined = undefined;
    if (data.pinCode !== undefined) {
      if (!data.pinCode) {
        pinCode = null;
        city = null;
        state = null;
      } else {
        const derived = await lookupPincode(data.pinCode);
        pinCode = derived.pinCode;
        city = derived.city;
        state = derived.state;
      }
    }

    let channelNodeId: string | null | undefined = undefined;
    if (data.channelNodeId !== undefined) {
      if (!data.channelNodeId) {
        channelNodeId = null;
      } else {
        const node = await this.prisma.channelHierarchyNode.findUnique({ where: { id: data.channelNodeId } });
        if (!node) throw new BadRequestException('Channel hierarchy node not found');
        if (node.level !== 2) {
          throw new BadRequestException('Retailers may only be mapped to a Level-2 channel hierarchy node');
        }
        channelNodeId = data.channelNodeId;
      }
    }

    return { gstin, pinCode, city, state, channelNodeId };
  }
}

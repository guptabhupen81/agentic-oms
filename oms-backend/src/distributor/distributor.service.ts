import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { isValidGstin } from '../common/gstin.util';
import { lookupPincode } from '../common/pincode.util';

export interface DistributorInput {
  code: string;
  name: string;
  gstin?: string;
  pinCode?: string;
  address?: string;
}

const CODE_FORMAT = /^[A-Za-z0-9_-]{2,30}$/;

@Injectable()
export class DistributorService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.distributor.findMany({ orderBy: { name: 'asc' } });
  }

  async findById(id: string) {
    const d = await this.prisma.distributor.findUnique({ where: { id } });
    if (!d) throw new NotFoundException('Distributor not found');
    return d;
  }

  /**
   * Creates the distributor AND its DB_ADMIN login in one transaction. The
   * login ID is the distributor code, so it is immutable after creation.
   */
  async create(data: DistributorInput & { initialPassword: string }) {
    const code = (data.code ?? '').trim().toUpperCase();
    if (!CODE_FORMAT.test(code)) {
      throw new BadRequestException('Distributor code must be 2-30 characters: letters, digits, "-" or "_"');
    }
    if (!data.initialPassword || data.initialPassword.length < 8) {
      throw new BadRequestException('Initial DB Admin password must be at least 8 characters');
    }
    if (code === 'MDM_ADMIN') throw new BadRequestException('This code is reserved for the MDM Admin login');

    const geo = await this.prepareGeo(data);
    const passwordHash = await bcrypt.hash(data.initialPassword, 10);

    return this.prisma.$transaction(async (tx: any) => {
      const distributor = await tx.distributor.create({
        data: { code, name: data.name, gstin: geo.gstin, pinCode: geo.pinCode, city: geo.city, state: geo.state, address: data.address },
      });
      await tx.user.create({
        data: { name: `${data.name} Admin`, loginId: code, passwordHash, role: 'DB_ADMIN', distributorId: distributor.id },
      });
      return distributor;
    });
  }

  /** Code is not editable — it is the DB Admin's login ID. */
  async update(id: string, data: Partial<Omit<DistributorInput, 'code'>>) {
    await this.findById(id);
    const geo = await this.prepareGeo(data);
    return this.prisma.distributor.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.gstin !== undefined ? { gstin: geo.gstin } : {}),
        ...(data.pinCode !== undefined ? { pinCode: geo.pinCode, city: geo.city, state: geo.state } : {}),
        ...(data.address !== undefined ? { address: data.address } : {}),
      },
    });
  }

  /** Deactivating a distributor also blocks its DB Admin from logging in (checked at login). */
  async setActive(id: string, isActive: boolean) {
    await this.findById(id);
    return this.prisma.distributor.update({ where: { id }, data: { isActive } });
  }

  async resetPassword(id: string, newPassword: string) {
    if (!newPassword || newPassword.length < 8) throw new BadRequestException('Password must be at least 8 characters');
    await this.findById(id);
    const result = await this.prisma.user.updateMany({
      where: { distributorId: id, role: 'DB_ADMIN' },
      data: { passwordHash: await bcrypt.hash(newPassword, 10) },
    });
    if (result.count === 0) throw new NotFoundException('No DB Admin login exists for this distributor');
    return { reset: true };
  }

  private async prepareGeo(data: Partial<DistributorInput>) {
    let gstin: string | null | undefined;
    if (data.gstin !== undefined) {
      if (!data.gstin) gstin = null;
      else {
        const g = data.gstin.trim().toUpperCase();
        if (!isValidGstin(g)) throw new BadRequestException(`Invalid GSTIN: ${data.gstin} (fails format/checksum validation)`);
        gstin = g;
      }
    }
    let pinCode: string | null | undefined, city: string | null | undefined, state: string | null | undefined;
    if (data.pinCode !== undefined) {
      if (!data.pinCode) { pinCode = null; city = null; state = null; }
      else {
        const d = await lookupPincode(data.pinCode);
        pinCode = d.pinCode; city = d.city; state = d.state;
      }
    }
    return { gstin, pinCode, city, state };
  }
}

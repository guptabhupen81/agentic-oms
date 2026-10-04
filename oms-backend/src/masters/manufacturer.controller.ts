import { BadRequestException, Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Roles } from '../auth/roles.decorator';
import { isValidGstin } from '../common/gstin.util';

/** Read: any authenticated role. Create/edit: MDM_ADMIN only. */
@Controller('manufacturers')
export class ManufacturerController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list() {
    return this.prisma.manufacturer.findMany({ orderBy: { name: 'asc' } });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.prisma.manufacturer.findUnique({ where: { id } });
  }

  @Roles(UserRole.MDM_ADMIN)
  @Post()
  create(@Body() body: { name: string; gstin?: string }) {
    return this.prisma.manufacturer.create({ data: { name: body.name, gstin: this.cleanGstin(body.gstin) } });
  }

  @Roles(UserRole.MDM_ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: { name?: string; gstin?: string }) {
    return this.prisma.manufacturer.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.gstin !== undefined ? { gstin: this.cleanGstin(body.gstin) } : {}),
      },
    });
  }

  private cleanGstin(gstin?: string): string | null {
    if (!gstin) return null;
    const g = gstin.trim().toUpperCase();
    if (!isValidGstin(g)) throw new BadRequestException(`Invalid GSTIN: ${gstin} (fails format/checksum validation)`);
    return g;
  }
}

import { Controller, Get, Param } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** View-only master, as specified — Manufacturers are created via the
 * Purchase/onboarding process elsewhere, not managed directly in this UI. */
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
}

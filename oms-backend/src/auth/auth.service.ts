import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Login ID is the Distributor code for a DB_ADMIN and "MDM_Admin" for the
   * MDM admin. An email is still accepted in the same field so the existing
   * mobile app logins keep working.
   */
  async login(loginId: string, password: string) {
    const id = loginId.trim();
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ loginId: { equals: id, mode: 'insensitive' } }, { email: { equals: id, mode: 'insensitive' } }] },
      include: { distributor: true },
    });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    if (user.role === 'DB_ADMIN' && !user.distributor?.isActive) {
      throw new UnauthorizedException('This distributor is inactive — contact MDM Admin');
    }

    const payload = {
      sub: user.id,
      role: user.role,
      loginId: user.loginId,
      email: user.email,
      distributorId: user.distributorId,
    };
    return {
      accessToken: await this.jwtService.signAsync(payload),
      user: {
        id: user.id,
        name: user.name,
        loginId: user.loginId,
        email: user.email,
        role: user.role,
        distributorId: user.distributorId,
        distributorName: user.distributor?.name ?? null,
      },
    };
  }

  /** MDM_ADMIN-only (see controller). DB_ADMIN users are normally created
   * automatically when a Distributor is created; this is for other roles. */
  async createUser(input: { name: string; loginId: string; email?: string; password: string; role: string; distributorId?: string }) {
    if (input.role === 'DB_ADMIN' && !input.distributorId) {
      throw new BadRequestException('A DB_ADMIN user must be linked to a distributor');
    }
    const passwordHash = await bcrypt.hash(input.password, 10);
    return this.prisma.user.create({
      data: {
        name: input.name,
        loginId: input.loginId,
        email: input.email,
        passwordHash,
        role: input.role as any,
        distributorId: input.distributorId,
      },
      select: { id: true, name: true, loginId: true, email: true, role: true, distributorId: true },
    });
  }
}

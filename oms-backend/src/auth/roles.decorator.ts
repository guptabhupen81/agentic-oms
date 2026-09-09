import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';
/** Restricts a route to specific UserRoles. Requires JwtAuthGuard to have
 * already run (so request.user.role is populated) — apply RolesGuard after it. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

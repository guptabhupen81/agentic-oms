import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../auth/current-user.decorator';

/**
 * Returns the distributorId a request must be confined to, or undefined when
 * the caller is not distributor-scoped. A DB_ADMIN is ALWAYS confined to their
 * own distributor; a DB_ADMIN token without one is rejected outright.
 */
export function distributorScope(user: AuthUser | undefined): string | undefined {
  if (user?.role === 'DB_ADMIN') {
    if (!user.distributorId) throw new ForbiddenException('This login is not linked to a distributor');
    return user.distributorId;
  }
  return undefined;
}

/** 404 (not 403) on a cross-distributor hit, so ids of other distributors' rows are not confirmed to exist. */
export function assertInScope(rowDistributorId: string | null | undefined, scope: string | undefined, what: string) {
  if (scope && rowDistributorId !== scope) throw new NotFoundException(`${what} not found`);
}

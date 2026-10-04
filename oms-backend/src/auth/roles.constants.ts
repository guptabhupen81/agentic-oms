import { UserRole } from '@prisma/client';

/** Everyone who works on the distributor side (Agents + distributor masters).
 * Deliberately everything EXCEPT MDM_ADMIN — the legacy operational roles stay
 * here so the mobile app's PRESELLER / VAN_SELLER logins keep working. */
export const DISTRIBUTOR_SIDE_ROLES: UserRole[] = [
  UserRole.DB_ADMIN,
  UserRole.ADMIN,
  UserRole.OMS_EXECUTIVE,
  UserRole.PRESELLER,
  UserRole.WAREHOUSE_INCHARGE,
  UserRole.VAN_SELLER,
];

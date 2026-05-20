export { USER_ROLES, isUserRole, parseUserRole } from "./types";
export type { UserRole } from "./types";
export {
  grantClientAccess,
  revokeClientAccess,
  listAccessesForClient,
  listClientsForOwner,
  hasClientAccess,
} from "./client-access.service";
export type { ClientAccessSummary, OwnerClientSummary } from "./client-access.service";

export {
  createTenant,
  getTenantBySlug,
  getTenantById,
  listTenants,
  verifyTenantAccess,
} from "./service";
export type { Tenant, TenantContext, CreateTenantInput, TenantWithStats } from "./types";

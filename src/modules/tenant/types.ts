export interface Tenant {
  id: string;
  userId: string;
  name: string;
  slug: string;
  cui: string | null;
  caen: string | null;
  active: boolean;
  createdAt: Date;
}

export interface TenantContext {
  tenantId: string;
  userId: string;
}

export interface CreateTenantInput {
  name: string;
  cui?: string;
  caen?: string;
}

export interface TenantWithStats extends Tenant {
  datasetCount: number;
}

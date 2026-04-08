export interface RequestContext {
  userId: string;
  tenantId: string;
  roles: Role[];
  ip?: string;
  userAgent?: string;
}

export type Role =
  | "platform_admin"
  | "account_owner"
  | "org_admin"
  | "org_manager"
  | "org_member"
  | "org_viewer";

export type PipelineStage =
  | "ingest"
  | "normalize"
  | "classify"
  | "journal"
  | "balance"
  | "export"
  | "budget"
  | "admin";

export type ActorType = "user" | "system" | "scheduler" | "rule_engine";

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
}

export function paginate<T>(
  items: T[],
  total: number,
  params: PaginationParams
): PaginatedResult<T> {
  return {
    items,
    total,
    page: params.page,
    limit: params.limit,
    hasNext: params.page * params.limit < total,
  };
}

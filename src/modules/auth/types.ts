import type { Role } from "@/shared/types";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  active: boolean;
  emailVerified: boolean;
}

export interface AuthContext {
  user: SessionUser;
  roles: Role[];
}

export type Permission = {
  resource: PermissionResource;
  action: PermissionAction;
};

export type PermissionResource =
  | "client"
  | "dataset"
  | "journal"
  | "balance"
  | "report"
  | "rule"
  | "user"
  | "settings";

export type PermissionAction =
  | "read"
  | "create"
  | "update"
  | "delete"
  | "approve"
  | "export";

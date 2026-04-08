import type { Role } from "@/shared/types";
import type { Permission, PermissionAction, PermissionResource } from "./types";

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  platform_admin: allPermissions(),
  account_owner: allPermissions(),
  org_admin: allPermissions(),
  org_manager: [
    ...readAll(),
    { resource: "dataset", action: "create" },
    { resource: "dataset", action: "update" },
    { resource: "journal", action: "update" },
    { resource: "report", action: "export" },
    { resource: "rule", action: "create" },
    { resource: "rule", action: "update" },
  ],
  org_member: [
    ...readAll(),
    { resource: "dataset", action: "create" },
    { resource: "journal", action: "update" },
  ],
  org_viewer: readAll(),
};

export function hasPermission(roles: Role[], required: Permission): boolean {
  return roles.some((role) => {
    const perms = ROLE_PERMISSIONS[role];
    return perms.some(
      (p) => p.resource === required.resource && p.action === required.action
    );
  });
}

export function authorize(roles: Role[], required: Permission): void {
  if (!hasPermission(roles, required)) {
    throw new Error(
      `Forbidden: missing ${required.action} on ${required.resource}`
    );
  }
}

function readAll(): Permission[] {
  const resources: PermissionResource[] = [
    "client", "dataset", "journal", "balance", "report", "rule", "user", "settings",
  ];
  return resources.map((resource) => ({ resource, action: "read" as PermissionAction }));
}

function allPermissions(): Permission[] {
  const resources: PermissionResource[] = [
    "client", "dataset", "journal", "balance", "report", "rule", "user", "settings",
  ];
  const actions: PermissionAction[] = [
    "read", "create", "update", "delete", "approve", "export",
  ];
  return resources.flatMap((resource) =>
    actions.map((action) => ({ resource, action }))
  );
}

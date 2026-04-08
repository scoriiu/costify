import { describe, it, expect } from "vitest";
import { hasPermission, authorize } from "@/modules/auth/rbac";
import type { Role } from "@/shared/types";
import type { Permission } from "@/modules/auth/types";

describe("hasPermission", () => {
  it("platform_admin has all permissions", () => {
    const roles: Role[] = ["platform_admin"];
    expect(hasPermission(roles, { resource: "client", action: "delete" })).toBe(true);
    expect(hasPermission(roles, { resource: "dataset", action: "create" })).toBe(true);
    expect(hasPermission(roles, { resource: "settings", action: "update" })).toBe(true);
  });

  it("account_owner has all permissions", () => {
    const roles: Role[] = ["account_owner"];
    expect(hasPermission(roles, { resource: "journal", action: "delete" })).toBe(true);
    expect(hasPermission(roles, { resource: "report", action: "export" })).toBe(true);
  });

  it("org_viewer can only read", () => {
    const roles: Role[] = ["org_viewer"];
    expect(hasPermission(roles, { resource: "client", action: "read" })).toBe(true);
    expect(hasPermission(roles, { resource: "dataset", action: "read" })).toBe(true);
    expect(hasPermission(roles, { resource: "journal", action: "read" })).toBe(true);
    expect(hasPermission(roles, { resource: "report", action: "read" })).toBe(true);

    expect(hasPermission(roles, { resource: "client", action: "create" })).toBe(false);
    expect(hasPermission(roles, { resource: "dataset", action: "delete" })).toBe(false);
    expect(hasPermission(roles, { resource: "settings", action: "update" })).toBe(false);
  });

  it("org_member can read and create datasets and update journal", () => {
    const roles: Role[] = ["org_member"];
    expect(hasPermission(roles, { resource: "dataset", action: "read" })).toBe(true);
    expect(hasPermission(roles, { resource: "dataset", action: "create" })).toBe(true);
    expect(hasPermission(roles, { resource: "journal", action: "update" })).toBe(true);

    expect(hasPermission(roles, { resource: "client", action: "delete" })).toBe(false);
    expect(hasPermission(roles, { resource: "rule", action: "create" })).toBe(false);
  });

  it("org_manager can create/update rules and export reports", () => {
    const roles: Role[] = ["org_manager"];
    expect(hasPermission(roles, { resource: "rule", action: "create" })).toBe(true);
    expect(hasPermission(roles, { resource: "rule", action: "update" })).toBe(true);
    expect(hasPermission(roles, { resource: "report", action: "export" })).toBe(true);

    expect(hasPermission(roles, { resource: "user", action: "delete" })).toBe(false);
  });

  it("checks across multiple roles (union)", () => {
    const roles: Role[] = ["org_viewer", "org_member"];
    expect(hasPermission(roles, { resource: "dataset", action: "create" })).toBe(true);
    expect(hasPermission(roles, { resource: "client", action: "read" })).toBe(true);
  });

  it("returns false for empty roles", () => {
    expect(hasPermission([], { resource: "client", action: "read" })).toBe(false);
  });
});

describe("authorize", () => {
  it("does not throw when permission is granted", () => {
    expect(() => {
      authorize(["account_owner"], { resource: "client", action: "create" });
    }).not.toThrow();
  });

  it("throws when permission is denied", () => {
    expect(() => {
      authorize(["org_viewer"], { resource: "client", action: "delete" });
    }).toThrow("Forbidden");
  });

  it("error message includes resource and action", () => {
    expect(() => {
      authorize(["org_viewer"], { resource: "settings", action: "update" });
    }).toThrow(/update.*settings/);
  });
});

/**
 * Identity-level role of a user. Distinct from RBAC permissions in
 * `modules/auth/rbac.ts` — this answers "what kind of person is this user?".
 *
 * - ACCOUNTANT: a person who manages a portfolio of client firms.
 * - OWNER:      a person who owns/runs one or more firms; only sees /firma.
 *
 * The string values match what is stored in `User.userRole` (PostgreSQL).
 */

export const USER_ROLES = ["ACCOUNTANT", "OWNER"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && (USER_ROLES as readonly string[]).includes(value);
}

export function parseUserRole(value: unknown): UserRole {
  return isUserRole(value) ? value : "ACCOUNTANT";
}

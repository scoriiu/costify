import { describe, it, expect } from "vitest";
import { USER_ROLES, isUserRole, parseUserRole } from "@/modules/roles/types";

describe("USER_ROLES", () => {
  it("contains exactly ACCOUNTANT and OWNER", () => {
    expect([...USER_ROLES]).toEqual(["ACCOUNTANT", "OWNER"]);
  });
});

describe("isUserRole", () => {
  it("accepts ACCOUNTANT and OWNER", () => {
    expect(isUserRole("ACCOUNTANT")).toBe(true);
    expect(isUserRole("OWNER")).toBe(true);
  });

  it("rejects other strings", () => {
    expect(isUserRole("admin")).toBe(false);
    expect(isUserRole("owner")).toBe(false); // case sensitive
    expect(isUserRole("ACCT")).toBe(false);
    expect(isUserRole("")).toBe(false);
  });

  it("rejects non-string inputs", () => {
    expect(isUserRole(null)).toBe(false);
    expect(isUserRole(undefined)).toBe(false);
    expect(isUserRole(42)).toBe(false);
    expect(isUserRole({})).toBe(false);
  });
});

describe("parseUserRole", () => {
  it("returns the role when valid", () => {
    expect(parseUserRole("ACCOUNTANT")).toBe("ACCOUNTANT");
    expect(parseUserRole("OWNER")).toBe("OWNER");
  });

  it("defaults to ACCOUNTANT for invalid input", () => {
    expect(parseUserRole("admin")).toBe("ACCOUNTANT");
    expect(parseUserRole("owner")).toBe("ACCOUNTANT");
    expect(parseUserRole(null)).toBe("ACCOUNTANT");
    expect(parseUserRole(undefined)).toBe("ACCOUNTANT");
    expect(parseUserRole("")).toBe("ACCOUNTANT");
  });
});

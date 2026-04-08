import { describe, it, expect } from "vitest";
import {
  ok,
  err,
  appError,
  notFound,
  unauthorized,
  forbidden,
  validation,
  conflict,
} from "@/shared/errors";
import type { Result, AppError } from "@/shared/errors";

describe("Result pattern", () => {
  it("ok wraps data with ok: true", () => {
    const result = ok(42);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toBe(42);
  });

  it("err wraps error with ok: false", () => {
    const error = appError("NOT_FOUND", "missing");
    const result = err(error);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND");
      expect(result.error.message).toBe("missing");
    }
  });

  it("ok result can carry complex types", () => {
    const result: Result<{ id: string; items: number[] }> = ok({
      id: "abc",
      items: [1, 2, 3],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.id).toBe("abc");
      expect(result.data.items).toEqual([1, 2, 3]);
    }
  });

  it("err result carries context", () => {
    const result = err(appError("VALIDATION", "bad input", { field: "email" }));
    if (!result.ok) {
      expect(result.error.context).toEqual({ field: "email" });
    }
  });
});

describe("error factories", () => {
  it("notFound creates NOT_FOUND error with entity and id", () => {
    const error = notFound("Client", "abc-123");
    expect(error.code).toBe("NOT_FOUND");
    expect(error.message).toBe("Client not found");
    expect(error.context).toEqual({ id: "abc-123" });
  });

  it("unauthorized creates UNAUTHORIZED error", () => {
    const error = unauthorized();
    expect(error.code).toBe("UNAUTHORIZED");
    expect(error.message).toBe("Unauthorized");
  });

  it("unauthorized accepts custom message", () => {
    const error = unauthorized("Token expired");
    expect(error.message).toBe("Token expired");
  });

  it("forbidden creates FORBIDDEN error", () => {
    const error = forbidden("No access to this resource");
    expect(error.code).toBe("FORBIDDEN");
    expect(error.message).toBe("No access to this resource");
  });

  it("validation creates VALIDATION error with context", () => {
    const error = validation("Name too short", { min: 2, got: 1 });
    expect(error.code).toBe("VALIDATION");
    expect(error.context).toEqual({ min: 2, got: 1 });
  });

  it("conflict creates CONFLICT error", () => {
    const error = conflict("Email already exists", { email: "a@b.com" });
    expect(error.code).toBe("CONFLICT");
    expect(error.context).toEqual({ email: "a@b.com" });
  });

  it("appError creates error with all fields", () => {
    const error: AppError = appError("INTERNAL", "server error", { trace: "xyz" });
    expect(error.code).toBe("INTERNAL");
    expect(error.message).toBe("server error");
    expect(error.context).toEqual({ trace: "xyz" });
  });

  it("appError works without context", () => {
    const error = appError("INTERNAL", "oops");
    expect(error.context).toBeUndefined();
  });
});

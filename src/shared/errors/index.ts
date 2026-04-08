export type Result<T, E = AppError> =
  | { ok: true; data: T }
  | { ok: false; error: E };

export function ok<T>(data: T): Result<T, never> {
  return { ok: true, data };
}

export function err<E = AppError>(error: E): Result<never, E> {
  return { ok: false, error };
}

export type ErrorCode =
  | "VALIDATION"
  | "NOT_FOUND"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "CONFLICT"
  | "PARSE_ERROR"
  | "INTERNAL"
  | "TENANT_MISMATCH"
  | "AUDIT_TAMPER";

export interface AppError {
  code: ErrorCode;
  message: string;
  context?: Record<string, unknown>;
}

export function appError(
  code: ErrorCode,
  message: string,
  context?: Record<string, unknown>
): AppError {
  return { code, message, context };
}

export function notFound(entity: string, id: string): AppError {
  return appError("NOT_FOUND", `${entity} not found`, { id });
}

export function unauthorized(message = "Unauthorized"): AppError {
  return appError("UNAUTHORIZED", message);
}

export function forbidden(message = "Forbidden"): AppError {
  return appError("FORBIDDEN", message);
}

export function validation(message: string, context?: Record<string, unknown>): AppError {
  return appError("VALIDATION", message, context);
}

export function conflict(message: string, context?: Record<string, unknown>): AppError {
  return appError("CONFLICT", message, context);
}

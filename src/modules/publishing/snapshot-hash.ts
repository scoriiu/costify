import { createHash } from "crypto";
import type { OwnerSnapshot } from "@/modules/reporting/owner";

/**
 * Canonical SHA-256 hash of a snapshot. Keys are sorted recursively so the
 * same conceptual snapshot always hashes the same regardless of object key
 * insertion order or JSON whitespace.
 */
export function computeSnapshotHash(snapshot: OwnerSnapshot): string {
  const canonical = canonicalize(snapshot as unknown);
  return createHash("sha256").update(canonical).digest("hex");
}

function canonicalize(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    return `{${keys
      .map((k) => `${JSON.stringify(k)}:${canonicalize((value as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  }
  return "null";
}

/**
 * Minimal KPI digest stored in audit events (instead of the full snapshot).
 * 6 numbers + the hash + period coords. Keeps audit row small but recoverable.
 */
export interface SnapshotDigest {
  cifra: number;
  profit: number;
  cash: number;
  receivables: number;
  payables: number;
  ownerWithdrawals: number;
  snapshotHash: string;
}

export function digestSnapshot(snapshot: OwnerSnapshot, hash: string): SnapshotDigest {
  return {
    cifra: snapshot.summary?.cifraAfaceriLuna ?? 0,
    profit:
      (snapshot.summary?.cifraAfaceriLuna ?? 0) - (snapshot.summary?.cheltuieliLuna ?? 0),
    cash:
      (snapshot.summary?.soldRegistruCasa ?? 0) +
      (snapshot.summary?.soldConturiBancare ?? 0),
    receivables: snapshot.summary?.clientiNeincasati ?? 0,
    payables: snapshot.summary?.furnizoriNeachitati ?? 0,
    ownerWithdrawals: snapshot.ownerWithdrawals?.total ?? 0,
    snapshotHash: hash,
  };
}

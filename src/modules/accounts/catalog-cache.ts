import { prisma } from "@/lib/db";
import type {
  AccountSpecial,
  AccountType,
  ApRole,
  ArRole,
  CashRole,
  CatalogAccount,
  CppGroup,
  PayrollRole,
  VatRole,
} from "./types";
import { deriveFlags } from "./flags";

let cachePromise: Promise<Map<string, CatalogAccount>> | null = null;

export async function loadCatalog(): Promise<Map<string, CatalogAccount>> {
  if (!cachePromise) {
    cachePromise = fetchCatalog();
  }
  return cachePromise;
}

export function invalidateCatalog(): void {
  cachePromise = null;
}

async function fetchCatalog(): Promise<Map<string, CatalogAccount>> {
  const rows = await prisma.accountCatalog.findMany();
  const map = new Map<string, CatalogAccount>();
  for (const r of rows) {
    const special = (r.special as AccountSpecial | null) ?? null;
    const derived = deriveFlags(r.code, special);
    map.set(r.code, {
      code: r.code,
      name: r.name,
      type: r.type as AccountType,
      classDigit: r.classDigit,
      cppGroup: (r.cppGroup as CppGroup | null) ?? null,
      cppLabel: r.cppLabel ?? null,
      cppLine: r.cppLine ?? null,
      cppLineLabel: r.cppLineLabel ?? null,
      special,

      isClosing: r.isClosing ?? derived.isClosing,
      isProfitTax: r.isProfitTax ?? derived.isProfitTax,
      isProfitDistribution: r.isProfitDistribution ?? derived.isProfitDistribution,
      isExtraBilantier: r.isExtraBilantier ?? derived.isExtraBilantier,
      isIfrsOnly: r.isIfrsOnly ?? false,

      cashRole: (r.cashRole as CashRole | null) ?? derived.cashRole,
      arRole: (r.arRole as ArRole | null) ?? derived.arRole,
      apRole: (r.apRole as ApRole | null) ?? derived.apRole,
      vatRole: (r.vatRole as VatRole | null) ?? derived.vatRole,
      payrollRole: (r.payrollRole as PayrollRole | null) ?? derived.payrollRole,
    });
  }
  return map;
}

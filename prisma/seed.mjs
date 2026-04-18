/**
 * Production-safe seed script. Pure JS, no tsx/ts-node dependency.
 * Loads seeds/omfp-1802.json into AccountCatalog via upsert (idempotent).
 * Runs in the init container on every deploy.
 *
 * Also derives and writes the D5/D8/D9/D11 behavioral flags per
 * docs/decisions/0001-plan-de-conturi-refactor.md. The derivation logic
 * mirrors src/modules/accounts/flags.ts and is duplicated here because this
 * file must be plain Node JS (no TS compile step in the init container).
 */

import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const prisma = new PrismaClient();

// --- flag derivation (mirrors src/modules/accounts/flags.ts) ---

function isClosingCode(code) {
  return code === "121" || code === "1211" || code === "1212";
}

function isProfitTaxCode(code) {
  return (
    code === "691" ||
    code === "694" ||
    code === "695" ||
    code === "697" ||
    code === "698"
  );
}

function isProfitDistributionCode(code) {
  return code === "129";
}

function isExtraBilantierCode(code) {
  if (!code) return false;
  const f = code[0];
  return f === "8" || f === "9";
}

function deriveCashRole(code) {
  if (code === "5121" || code === "5124") return "cash_direct";
  if (code === "5311" || code === "5314") return "cash_direct";
  if (code === "542") return "cash_advance";
  if (code === "581" || code === "5125") return "transit";
  return null;
}

function deriveArRole(code) {
  if (code === "4111") return "ar_primary";
  if (code === "4118") return "ar_doubtful";
  if (code === "418") return "ar_pending";
  if (code === "419") return "customer_advance";
  return null;
}

function deriveApRole(code) {
  if (code === "401" || code === "404") return "ap_primary";
  if (code === "408") return "ap_pending";
  if (code === "409") return "supplier_advance";
  return null;
}

function deriveVatRole(code) {
  if (code === "4427") return "vat_collected";
  if (code === "4426") return "vat_deductible";
  if (code === "4423") return "vat_payable";
  if (code === "4424") return "vat_receivable";
  if (code === "4428") return "vat_pending";
  return null;
}

function derivePayrollRole(code) {
  const salary = new Set(["421", "423", "425", "426", "427", "428"]);
  if (salary.has(code)) return "salary";
  const social = new Set([
    "4311", "4312", "4313", "4314", "4315", "4316", "4317", "4318",
    "4371", "4372", "4441",
  ]);
  if (social.has(code)) return "social_contrib";
  return null;
}

function deriveFlags(code, legacySpecial) {
  return {
    isClosing: isClosingCode(code) || legacySpecial === "pl_closing",
    isProfitTax:
      isProfitTaxCode(code) ||
      legacySpecial === "profit_tax" ||
      legacySpecial === "micro_tax",
    isProfitDistribution:
      isProfitDistributionCode(code) || legacySpecial === "profit_distribution",
    isExtraBilantier: isExtraBilantierCode(code),
    cashRole: deriveCashRole(code),
    arRole: deriveArRole(code),
    apRole: deriveApRole(code),
    vatRole: deriveVatRole(code),
    payrollRole: derivePayrollRole(code),
  };
}

// --- seed ---

async function main() {
  const seedPath = join(process.cwd(), "seeds", "omfp-1802.json");
  const raw = readFileSync(seedPath, "utf-8");
  const data = JSON.parse(raw);

  console.log(`Loading ${data.version} — ${data.accounts.length} accounts`);

  const existing = await prisma.accountCatalog.count();
  console.log(`Existing catalog rows: ${existing}`);

  let created = 0;
  let updated = 0;

  for (const a of data.accounts) {
    const classDigit = parseInt(a.code.charAt(0), 10);
    if (isNaN(classDigit) || classDigit < 1 || classDigit > 9) {
      console.warn(`Skipping invalid code: ${a.code}`);
      continue;
    }

    const special = a.special ?? null;
    const f = deriveFlags(a.code, special);

    const payload = {
      code: a.code,
      name: a.name,
      type: a.type,
      classDigit,
      cppGroup: a.cppGroup ?? null,
      cppLabel: a.cppLabel ?? null,
      special,

      // D5 booleans
      isClosing: a.isClosing ?? f.isClosing,
      isProfitTax: a.isProfitTax ?? f.isProfitTax,
      isProfitDistribution: a.isProfitDistribution ?? f.isProfitDistribution,
      isExtraBilantier: a.isExtraBilantier ?? f.isExtraBilantier,
      isIfrsOnly: a.isIfrsOnly ?? false,

      // D8/D9 roles
      cashRole: a.cashRole ?? f.cashRole,
      arRole: a.arRole ?? f.arRole,
      apRole: a.apRole ?? f.apRole,
      vatRole: a.vatRole ?? f.vatRole,
      payrollRole: a.payrollRole ?? f.payrollRole,
    };

    const result = await prisma.accountCatalog.upsert({
      where: { code: a.code },
      create: payload,
      update: payload,
    });

    if (result.createdAt.getTime() === result.updatedAt.getTime()) {
      created++;
    } else {
      updated++;
    }
  }

  console.log(`Seeded AccountCatalog: ${created} created, ${updated} updated`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

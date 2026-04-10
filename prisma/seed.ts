import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { OmfpSeedFile } from "../src/modules/accounts/types";

const prisma = new PrismaClient();

async function main() {
  await seedAccountCatalog();
}

async function seedAccountCatalog() {
  const seedPath = join(process.cwd(), "seeds", "omfp-1802.json");
  const raw = readFileSync(seedPath, "utf-8");
  const data = JSON.parse(raw) as OmfpSeedFile;

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

    const result = await prisma.accountCatalog.upsert({
      where: { code: a.code },
      create: {
        code: a.code,
        name: a.name,
        type: a.type,
        classDigit,
        cppGroup: a.cppGroup ?? null,
        cppLabel: a.cppLabel ?? null,
        special: a.special ?? null,
      },
      update: {
        name: a.name,
        type: a.type,
        classDigit,
        cppGroup: a.cppGroup ?? null,
        cppLabel: a.cppLabel ?? null,
        special: a.special ?? null,
      },
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

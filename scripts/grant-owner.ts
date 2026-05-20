/**
 * Grants OWNER access to a client. Idempotent; safe to re-run.
 *
 * Usage:
 *   tsx scripts/grant-owner.ts <ownerEmail> <clientSlug> [--by=<accountantEmail>] [--name="..."]
 *
 * Example:
 *   tsx scripts/grant-owner.ts sorin.crisan@costify.ro qhm21-network-srl \
 *     --by=solomon.coriiu@costify.ro --name="Sorin Crisan"
 *
 * Behavior:
 *   - If the OWNER user doesn't exist, creates them with a random temp password
 *     printed to stdout (the operator must share it via side channel).
 *   - If the user exists with role=ACCOUNTANT, fails (cannot demote in a script).
 *   - If the user exists with role=OWNER, reuses them.
 *   - If a ClientAccess row already exists, prints "already granted" and exits 0.
 */

import { prisma } from "../src/lib/db";
import { grantClientAccess } from "../src/modules/roles/client-access.service";

interface Args {
  ownerEmail: string;
  clientSlug: string;
  byEmail: string | null;
  name: string | null;
}

function parseArgs(argv: string[]): Args {
  const positional: string[] = [];
  const flags: Record<string, string> = {};
  for (const arg of argv) {
    const m = arg.match(/^--([^=]+)=(.*)$/);
    if (m) flags[m[1]] = m[2];
    else positional.push(arg);
  }
  if (positional.length < 2) {
    throw new Error("Need <ownerEmail> <clientSlug>");
  }
  return {
    ownerEmail: positional[0],
    clientSlug: positional[1],
    byEmail: flags.by ?? null,
    name: flags.name ?? null,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const client = await prisma.client.findFirst({
    where: { slug: args.clientSlug, active: true },
    select: { id: true, name: true, slug: true, userId: true, user: { select: { email: true } } },
  });
  if (!client) throw new Error(`Client cu slug "${args.clientSlug}" nu exista`);

  let grantedById: string;
  if (args.byEmail) {
    const accountant = await prisma.user.findUnique({
      where: { email: args.byEmail.toLowerCase() },
      select: { id: true, userRole: true },
    });
    if (!accountant) throw new Error(`Contabil "${args.byEmail}" nu exista`);
    if (accountant.userRole !== "ACCOUNTANT") {
      throw new Error(`Contul "${args.byEmail}" nu este ACCOUNTANT (este ${accountant.userRole})`);
    }
    grantedById = accountant.id;
  } else {
    grantedById = client.userId;
    console.log(`[info] no --by= flag, using client owner ${client.user.email}`);
  }

  const result = await grantClientAccess({
    clientId: client.id,
    ownerEmail: args.ownerEmail,
    ownerName: args.name ?? args.ownerEmail.split("@")[0],
    grantedBy: grantedById,
  });

  console.log("\n=== Grant complete ===");
  console.log(`Client:       ${client.name} (${client.slug})`);
  console.log(`Owner email:  ${result.access.userEmail}`);
  console.log(`Owner name:   ${result.access.userName}`);
  console.log(`User created: ${result.isNewUser ? "yes" : "no (reused existing)"}`);
  if (result.temporaryPassword) {
    console.log(`\nTEMP PASSWORD (share via secure channel, shown ONCE):`);
    console.log(`  ${result.temporaryPassword}\n`);
  } else if (!result.isNewUser) {
    console.log(`\nUser already existed. Keep using their current password.`);
  }

  console.log("\nDone. They can now log in and access /firma.");
}

main()
  .catch((err) => {
    console.error("\nFailed:", err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

/**
 * Changes a user's identity role between ACCOUNTANT and OWNER.
 *
 * Usage:
 *   tsx scripts/set-user-role.ts <email> <ACCOUNTANT|OWNER>
 *
 * Safety:
 *   - Refuses to demote an ACCOUNTANT that owns active Clients (would orphan them).
 *   - Refuses to promote an OWNER that has ClientAccess rows pointing into it (no real risk,
 *     but the user is mid-grant, so we'd rather you decide explicitly).
 */

import { prisma } from "../src/lib/db";
import { isUserRole } from "../src/modules/roles/types";

async function main() {
  const [email, role] = process.argv.slice(2);
  if (!email || !role) throw new Error("Usage: set-user-role.ts <email> <ACCOUNTANT|OWNER>");
  if (!isUserRole(role)) throw new Error(`Invalid role "${role}". Use ACCOUNTANT or OWNER.`);

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: {
      _count: { select: { clients: { where: { active: true } }, clientAccesses: true } },
    },
  });
  if (!user) throw new Error(`User "${email}" not found`);

  if (user.userRole === role) {
    console.log(`[ok] ${email} is already ${role}`);
    return;
  }

  if (role === "OWNER" && user._count.clients > 0) {
    throw new Error(
      `Cannot demote ${email} to OWNER: they own ${user._count.clients} active Client(s). ` +
        `Transfer ownership first.`
    );
  }

  if (role === "ACCOUNTANT" && user._count.clientAccesses > 0) {
    throw new Error(
      `Cannot promote ${email} to ACCOUNTANT: they have ${user._count.clientAccesses} ClientAccess row(s). ` +
        `Revoke those first.`
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { userRole: role },
  });

  console.log(`[ok] ${email}: ${user.userRole} → ${role}`);
}

main()
  .catch((err) => {
    console.error("Failed:", err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

/**
 * Service for managing OWNER access to a Client's /firma dashboard.
 *
 * Responsibilities:
 *   - grant: create-or-find the OWNER user, link them to the client, return
 *     a one-time temporary password (the caller shows it to the accountant).
 *   - revoke: remove the access row (the user stays, just loses this client).
 *   - list per client: who has OWNER access to this client?
 *   - list per OWNER: which clients can this OWNER see?
 *   - hasClientAccess: cheap boolean check for the resolver.
 *
 * Audit is the caller's responsibility (the route handler), not ours — we
 * keep this service pure-data so it stays testable.
 */

import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/modules/auth/password";
import { parseUserRole, type UserRole } from "./types";

export interface ClientAccessSummary {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  userRole: UserRole;
  clientId: string;
  role: string;
  createdAt: Date;
  createdBy: string | null;
}

export interface OwnerClientSummary {
  clientId: string;
  clientName: string;
  clientSlug: string;
  clientCui: string | null;
  grantedAt: Date;
}

const TEMP_PASSWORD_BYTES = 9; // 12-char base64url ≈ 72 bits entropy

function generateTempPassword(): string {
  return randomBytes(TEMP_PASSWORD_BYTES)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

interface GrantOptions {
  clientId: string;
  ownerEmail: string;
  ownerName: string;
  grantedBy: string;
}

interface GrantResult {
  access: ClientAccessSummary;
  isNewUser: boolean;
  /** Plain-text temporary password, present only when a new user was created. */
  temporaryPassword: string | null;
}

export async function grantClientAccess(opts: GrantOptions): Promise<GrantResult> {
  const email = opts.ownerEmail.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    throw new Error("Email invalid pentru acces patron");
  }

  return prisma.$transaction(async (tx) => {
    let user = await tx.user.findUnique({ where: { email } });
    let temporaryPassword: string | null = null;
    let isNewUser = false;

    if (!user) {
      const tempPw = generateTempPassword();
      const passwordHash = await hashPassword(tempPw);
      user = await tx.user.create({
        data: {
          email,
          name: opts.ownerName.trim() || email.split("@")[0],
          passwordHash,
          userRole: "OWNER",
          emailVerified: false,
          active: true,
        },
      });
      temporaryPassword = tempPw;
      isNewUser = true;
    } else if (user.userRole === "ACCOUNTANT") {
      throw new Error(
        "Acest email este deja folosit de un contabil; alege alt email pentru patron"
      );
    }

    const existing = await tx.clientAccess.findUnique({
      where: { userId_clientId: { userId: user.id, clientId: opts.clientId } },
    });

    const access = existing
      ? existing
      : await tx.clientAccess.create({
          data: {
            userId: user.id,
            clientId: opts.clientId,
            role: "OWNER",
            createdBy: opts.grantedBy,
          },
        });

    return {
      access: {
        id: access.id,
        userId: user.id,
        userEmail: user.email,
        userName: user.name,
        userRole: parseUserRole(user.userRole),
        clientId: access.clientId,
        role: access.role,
        createdAt: access.createdAt,
        createdBy: access.createdBy,
      },
      isNewUser,
      temporaryPassword,
    };
  });
}

interface RevokeOptions {
  clientId: string;
  userId: string;
}

export async function revokeClientAccess(opts: RevokeOptions): Promise<boolean> {
  const deleted = await prisma.clientAccess.deleteMany({
    where: { clientId: opts.clientId, userId: opts.userId },
  });
  return deleted.count > 0;
}

export async function listAccessesForClient(
  clientId: string
): Promise<ClientAccessSummary[]> {
  const rows = await prisma.clientAccess.findMany({
    where: { clientId },
    orderBy: { createdAt: "asc" },
    include: { user: true },
  });

  return rows.map((r) => ({
    id: r.id,
    userId: r.user.id,
    userEmail: r.user.email,
    userName: r.user.name,
    userRole: parseUserRole(r.user.userRole),
    clientId: r.clientId,
    role: r.role,
    createdAt: r.createdAt,
    createdBy: r.createdBy,
  }));
}

export async function listClientsForOwner(
  userId: string
): Promise<OwnerClientSummary[]> {
  const rows = await prisma.clientAccess.findMany({
    where: { userId, role: "OWNER", client: { active: true } },
    orderBy: { client: { name: "asc" } },
    include: { client: true },
  });

  return rows.map((r) => ({
    clientId: r.client.id,
    clientName: r.client.name,
    clientSlug: r.client.slug,
    clientCui: r.client.cui,
    grantedAt: r.createdAt,
  }));
}

export async function hasClientAccess(
  userId: string,
  clientId: string
): Promise<boolean> {
  const access = await prisma.clientAccess.findUnique({
    where: { userId_clientId: { userId, clientId } },
  });
  return access !== null;
}

/**
 * Resolves which client the current user sees in /firma.
 *
 * Decision matrix:
 *
 *   user role     | ?as= param        | result
 *   --------------|-------------------|--------------------------------------
 *   anonymous     | any               | redirect /login
 *   OWNER         | any (ignored)     | accesses[0] if 1, else "selector" if N, else "no-access"
 *   ACCOUNTANT    | missing           | redirect /clients
 *   ACCOUNTANT    | valid client id   | ok (their own client only)
 *   ACCOUNTANT    | invalid client id | redirect /clients
 *
 * The selector branch is rendered by `/firma/selectie`.
 */

import { prisma } from "@/lib/db";
import { getSessionUser } from "@/modules/auth/session";
import { listClientsForOwner, type OwnerClientSummary } from "@/modules/roles";
import { parseUserRole } from "@/modules/roles";

export type ResolvedSessionUser = {
  id: string;
  email: string;
  name: string;
  userRole: "ACCOUNTANT" | "OWNER";
};

export type ResolvedClient = {
  id: string;
  slug: string;
  name: string;
  cui: string | null;
};

export type ResolveResult =
  | { kind: "ok"; user: ResolvedSessionUser; client: ResolvedClient; viaAccountantPreview: boolean }
  | { kind: "selector"; user: ResolvedSessionUser; clients: OwnerClientSummary[] }
  | { kind: "redirect"; to: string }
  | { kind: "no-access"; user: ResolvedSessionUser };

interface ResolveOptions {
  /** Optional clientId from `?as=...`. Only honored for ACCOUNTANT users. */
  asClientId?: string | null;
  /** Optional client slug from `?firm=...`. Only honored for OWNER users with N firms. */
  firmSlug?: string | null;
}

export async function resolveFirmaContext(
  opts: ResolveOptions = {}
): Promise<ResolveResult> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { kind: "redirect", to: "/login" };

  const user: ResolvedSessionUser = {
    id: sessionUser.id,
    email: sessionUser.email,
    name: sessionUser.name,
    userRole: parseUserRole(sessionUser.userRole),
  };

  if (user.userRole === "OWNER") {
    return resolveOwnerContext(user, opts.firmSlug ?? null);
  }

  return resolveAccountantPreview(user, opts.asClientId ?? null);
}

async function resolveOwnerContext(
  user: ResolvedSessionUser,
  firmSlug: string | null
): Promise<ResolveResult> {
  const accesses = await listClientsForOwner(user.id);

  if (accesses.length === 0) return { kind: "no-access", user };

  if (firmSlug) {
    const picked = accesses.find((a) => a.clientSlug === firmSlug);
    if (picked) {
      return {
        kind: "ok",
        user,
        client: {
          id: picked.clientId,
          slug: picked.clientSlug,
          name: picked.clientName,
          cui: picked.clientCui,
        },
        viaAccountantPreview: false,
      };
    }
  }

  if (accesses.length === 1) {
    const a = accesses[0];
    return {
      kind: "ok",
      user,
      client: { id: a.clientId, slug: a.clientSlug, name: a.clientName, cui: a.clientCui },
      viaAccountantPreview: false,
    };
  }

  return { kind: "selector", user, clients: accesses };
}

async function resolveAccountantPreview(
  user: ResolvedSessionUser,
  asClientId: string | null
): Promise<ResolveResult> {
  if (!asClientId) {
    return { kind: "redirect", to: "/clients" };
  }

  const client = await prisma.client.findFirst({
    where: { id: asClientId, userId: user.id, active: true },
    select: { id: true, slug: true, name: true, cui: true },
  });

  if (!client) return { kind: "redirect", to: "/clients" };

  return {
    kind: "ok",
    user,
    client,
    viaAccountantPreview: true,
  };
}

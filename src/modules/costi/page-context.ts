/**
 * Page context for Costi: where in the app the user is asking from.
 *
 * The chat widget sends its current location (pathname + query) with every
 * request; we resolve it into "which client, which view" so Costi can
 * interpret "firma mea" / "clientul asta" without guessing via list_clients,
 * and can switch to the patron voice when the owner view is active.
 */
import { prisma } from "@/lib/db";

export interface ParsedPage {
  clientSlug: string | null;
  ownerView: boolean;
}

export interface PageContext {
  clientName: string;
  clientSlug: string;
  ownerView: boolean;
}

const CLIENT_PATH = /^\/clients\/([a-z0-9-]+)/;

export function parsePage(page: string | undefined | null): ParsedPage {
  if (!page) return { clientSlug: null, ownerView: false };
  let pathname = page;
  let search = "";
  const qIdx = page.indexOf("?");
  if (qIdx >= 0) {
    pathname = page.slice(0, qIdx);
    search = page.slice(qIdx + 1);
  }
  const match = pathname.match(CLIENT_PATH);
  const params = new URLSearchParams(search);
  return {
    clientSlug: match ? match[1] : null,
    ownerView: params.get("view") === "owner",
  };
}

/**
 * Resolve the page into a PageContext, scoped to the requesting user
 * (tenant isolation: a slug belonging to another user resolves to null).
 */
export async function resolvePageContext(
  userId: string,
  page: string | undefined | null
): Promise<PageContext | null> {
  const parsed = parsePage(page);
  if (!parsed.clientSlug) return null;

  const client = await prisma.client.findFirst({
    where: { userId, slug: parsed.clientSlug, active: true },
    select: { name: true, slug: true },
  });
  if (!client) return null;

  return {
    clientName: client.name,
    clientSlug: client.slug,
    ownerView: parsed.ownerView,
  };
}

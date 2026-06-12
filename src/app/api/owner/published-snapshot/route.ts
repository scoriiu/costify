import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/modules/auth/session";
import { verifyTenantAccess } from "@/modules/tenant/service";
import { hasClientAccess } from "@/modules/roles/client-access.service";
import { getPublishedView } from "@/modules/publishing";

/**
 * Returns the FROZEN published snapshot for one month. This is the only
 * owner-accessible data API: it never recomputes, never reads the live
 * journal, so an owner can only ever see what the accountant published.
 *
 * Used for client-side month switching inside dashboard cards (e.g. the
 * cashflow map) without a full page navigation.
 */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId");
  const year = Number(searchParams.get("year"));
  const month = Number(searchParams.get("month"));

  if (!clientId || !Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "Parametri invalizi" }, { status: 400 });
  }

  const [isAccountant, isOwner] = await Promise.all([
    verifyTenantAccess(user.id, clientId),
    hasClientAccess(user.id, clientId),
  ]);
  if (!isAccountant && !isOwner) {
    return NextResponse.json({ error: "Acces interzis" }, { status: 403 });
  }

  const published = await getPublishedView(clientId, year, month);
  if (!published) {
    return NextResponse.json({ error: "Luna nu este publicata" }, { status: 404 });
  }

  return NextResponse.json({
    year: published.year,
    month: published.month,
    publishedAt: published.publishedAt,
    snapshot: published.snapshot,
  });
}

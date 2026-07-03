import { NextResponse } from "next/server";
import { getSessionUser } from "@/modules/auth/session";
import { verifyTenantAccess } from "@/modules/tenant";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const url = new URL(request.url);
  const clientId = url.searchParams.get("clientId");
  const fromDate = url.searchParams.get("fromDate");

  if (!clientId || !fromDate) {
    return NextResponse.json({ error: "clientId si fromDate obligatorii" }, { status: 400 });
  }

  const hasAccess = await verifyTenantAccess(user.id, clientId);
  if (!hasAccess) return NextResponse.json({ error: "Acces interzis" }, { status: 403 });

  // Guard the year range too: a date typed as "100020-05-03" (mid-typing in
  // the year field) is a VALID JS Date that Prisma cannot convert — it threw
  // PrismaClientUnknownRequestError in prod. Reject anything outside the
  // plausible accounting window instead of passing it to the DB.
  const date = new Date(fromDate);
  if (isNaN(date.getTime()) || date.getFullYear() < 1990 || date.getFullYear() > 2100) {
    return NextResponse.json({ error: "Data invalida" }, { status: 400 });
  }

  const count = await prisma.journalLine.count({
    where: { clientId, deletedAt: null, data: { gte: date } },
  });

  const total = await prisma.journalLine.count({
    where: { clientId, deletedAt: null },
  });

  return NextResponse.json({ count, total, fromDate });
}

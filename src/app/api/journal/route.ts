import { NextResponse } from "next/server";
import { getSessionUser } from "@/modules/auth/session";
import { verifyTenantAccess } from "@/modules/tenant";
import { prisma } from "@/lib/db";

const MAX_LIMIT = 500;

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const url = new URL(request.url);
  const clientId = url.searchParams.get("clientId");
  if (!clientId) return NextResponse.json({ error: "clientId obligatoriu" }, { status: 400 });

  const hasAccess = await verifyTenantAccess(user.id, clientId);
  if (!hasAccess) return NextResponse.json({ error: "Acces interzis" }, { status: 403 });

  const offset = Math.max(0, parseInt(url.searchParams.get("offset") ?? "0"));
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(url.searchParams.get("limit") ?? "200")));

  const [entries, total] = await Promise.all([
    prisma.journalLine.findMany({
      where: { clientId, deletedAt: null },
      orderBy: [{ data: "desc" }, { ndp: "desc" }],
      skip: offset,
      take: limit,
      select: {
        id: true,
        data: true,
        year: true,
        month: true,
        ndp: true,
        contD: true,
        contDBase: true,
        contC: true,
        contCBase: true,
        suma: true,
        explicatie: true,
        felD: true,
      },
    }),
    prisma.journalLine.count({ where: { clientId, deletedAt: null } }),
  ]);

  return NextResponse.json({
    items: entries.map((e) => ({
      id: e.id,
      data: e.data.toISOString().split("T")[0],
      ndp: e.ndp,
      contD: e.contD,
      contC: e.contC,
      suma: Number(e.suma),
      explicatie: e.explicatie,
      felD: e.felD,
    })),
    total,
    offset,
    limit,
  });
}

import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getSessionUser } from "@/modules/auth/session";
import { verifyTenantAccess } from "@/modules/tenant";
import { prisma } from "@/lib/db";
import { parseJournalSearch } from "@/modules/ingestion/journal-search-query";

const MAX_LIMIT = 500;
const MAX_QUERY_LEN = 100;

interface JournalRow {
  id: string;
  data: Date;
  ndp: string | null;
  contD: string;
  contC: string;
  suma: string; // ::text cast
  explicatie: string | null;
  felD: string | null;
}

export async function GET(request: Request) {
  const t0 = performance.now();
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  const tSession = performance.now() - t0;

  const url = new URL(request.url);
  const clientId = url.searchParams.get("clientId");
  if (!clientId) return NextResponse.json({ error: "clientId obligatoriu" }, { status: 400 });

  const tAccessStart = performance.now();
  const hasAccess = await verifyTenantAccess(user.id, clientId);
  if (!hasAccess) return NextResponse.json({ error: "Acces interzis" }, { status: 403 });
  const tAccess = performance.now() - tAccessStart;

  const offset = Math.max(0, parseInt(url.searchParams.get("offset") ?? "0"));
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(url.searchParams.get("limit") ?? "200")));
  const rawQuery = (url.searchParams.get("q") ?? "").trim().slice(0, MAX_QUERY_LEN);

  const tQueryStart = performance.now();
  let entries: JournalRow[];
  let total: number;

  if (rawQuery) {
    // Search path: keep Prisma for the OR-search compilation. Search results
    // are bounded and infrequent, so ORM hydration is not the bottleneck here.
    const where: Prisma.JournalLineWhereInput = { clientId, deletedAt: null };
    const parsed = parseJournalSearch(rawQuery);
    if (parsed.or.length > 0) where.OR = parsed.or;

    const [searchEntries, searchTotal] = await Promise.all([
      prisma.journalLine.findMany({
        where,
        orderBy: [{ data: "desc" }, { ndp: "desc" }],
        skip: offset,
        take: limit,
        select: {
          id: true, data: true, ndp: true, contD: true, contC: true,
          suma: true, explicatie: true, felD: true,
        },
      }),
      prisma.journalLine.count({ where }),
    ]);
    entries = searchEntries.map((e) => ({
      id: e.id,
      data: e.data,
      ndp: e.ndp,
      contD: e.contD,
      contC: e.contC,
      suma: e.suma.toString(),
      explicatie: e.explicatie,
      felD: e.felD,
    }));
    total = searchTotal;
  } else {
    // Hot path: pagination with no search. Single index-walk over the partial
    // index `JournalLine(clientId, data DESC, ndp DESC) WHERE deletedAt IS NULL`
    // returns the page in 0.5 ms in Postgres. Using `$queryRaw` bypasses
    // Prisma's per-row Decimal/Date hydration — at 200 rows × 12 cols this
    // was the dominant cost. Cast `suma::text` so Node doesn't wrap it in
    // Prisma's Decimal class; we call Number() once at the response edge.
    const [rows, countRows] = await Promise.all([
      prisma.$queryRaw<JournalRow[]>`
        SELECT id, data, ndp, "contD", "contC",
               suma::text AS suma, explicatie, "felD"
        FROM "JournalLine"
        WHERE "clientId" = ${clientId} AND "deletedAt" IS NULL
        ORDER BY data DESC, ndp DESC
        OFFSET ${offset} LIMIT ${limit}
      `,
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS count
        FROM "JournalLine"
        WHERE "clientId" = ${clientId} AND "deletedAt" IS NULL
      `,
    ]);
    entries = rows;
    total = Number(countRows[0]?.count ?? 0);
  }
  const tQuery = performance.now() - tQueryStart;

  const tSerializeStart = performance.now();
  const response = NextResponse.json({
    items: entries.map((e) => ({
      id: e.id,
      data: e.data instanceof Date
        ? e.data.toISOString().split("T")[0]
        : String(e.data).split("T")[0],
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
  const tSerialize = performance.now() - tSerializeStart;

  const ttotal = performance.now() - t0;
  if (ttotal > 200) {
    console.warn(
      `[api/journal] SLOW total=${ttotal.toFixed(0)}ms session=${tSession.toFixed(0)}ms access=${tAccess.toFixed(0)}ms query=${tQuery.toFixed(0)}ms serialize=${tSerialize.toFixed(0)}ms entries=${entries.length} total_count=${total} q=${rawQuery ? `"${rawQuery}"` : "—"}`,
    );
  }

  return response;
}

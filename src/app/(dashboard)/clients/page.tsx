import { getSessionUser } from "@/modules/auth/session";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { ClientList } from "@/components/clients/client-list";

interface ClientListRow {
  id: string;
  slug: string;
  name: string;
  cui: string | null;
  caen: string | null;
  verticalsEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  entryCount: number;
  latestPubYear: number | null;
  latestPubMonth: number | null;
  latestPubAt: Date | null;
  latestPubStale: boolean;
}

export default async function ClientsPage() {
  const t0 = performance.now();
  const user = await getSessionUser();
  const tSession = performance.now() - t0;
  if (!user) redirect("/login");

  // Single roundtrip: every Client row joined LATERAL with its journal-line
  // count and latest published period. Prisma's include + _count would
  // issue one subquery per related table per client (1 + 2N queries),
  // each paying the port-forward RTT in dev. With 5 clients in dev that's
  // ~300 ms; in prod with 100+ clients per accountant it would be tens
  // of seconds. The LATERAL JOIN structure stays O(N) at the DB but is
  // ONE network roundtrip and avoids Prisma's ORM hydration.
  const tQueryStart = performance.now();
  const clients = await prisma.$queryRaw<ClientListRow[]>`
    SELECT
      c.id,
      c.slug,
      c.name,
      c.cui,
      c.caen,
      c."verticalsEnabled",
      c."createdAt",
      c."updatedAt",
      COALESCE(jl.count, 0)::int AS "entryCount",
      pp.year         AS "latestPubYear",
      pp.month        AS "latestPubMonth",
      pp."publishedAt" AS "latestPubAt",
      pp."staleSince" IS NOT NULL AS "latestPubStale"
    FROM "Client" c
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS count
      FROM "JournalLine" j
      WHERE j."clientId" = c.id AND j."deletedAt" IS NULL
    ) jl ON TRUE
    LEFT JOIN LATERAL (
      SELECT year, month, "publishedAt", "staleSince"
      FROM "PublishedPeriod"
      WHERE "clientId" = c.id
      ORDER BY year DESC, month DESC
      LIMIT 1
    ) pp ON TRUE
    WHERE c."userId" = ${user.id} AND c.active = TRUE
    ORDER BY c."updatedAt" DESC
  `;
  const tQuery = performance.now() - tQueryStart;

  const items = clients.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    cui: c.cui,
    caen: c.caen,
    entryCount: c.entryCount,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    verticalsEnabled: c.verticalsEnabled,
    latestPublished:
      c.latestPubYear !== null && c.latestPubMonth !== null && c.latestPubAt
        ? {
            year: c.latestPubYear,
            month: c.latestPubMonth,
            publishedAt: c.latestPubAt.toISOString(),
            isStale: c.latestPubStale,
          }
        : null,
  }));

  const ttotal = performance.now() - t0;
  if (ttotal > 200) {
    console.warn(
      `[page/clients] SLOW total=${ttotal.toFixed(0)}ms session=${tSession.toFixed(0)}ms query=${tQuery.toFixed(0)}ms clients=${clients.length}`,
    );
  }

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-7xl mx-auto">
      <ClientList clients={items} />
    </div>
  );
}

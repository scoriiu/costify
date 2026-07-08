import { getSessionUser } from "@/modules/auth/session";
import { redirect } from "next/navigation";
import { isInternalUser } from "@/lib/internal-access";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const DAYS_SHOWN = 30;
const REQUESTS_SHOWN = 50;

interface DayRow {
  day: string;
  requests: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cost_usd: string;
}

function usd(n: number, digits = 2): string {
  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

function tok(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

const CELL = "border-r border-white/[0.04] py-2.5 px-3 last:border-r-0";
const NUM = `${CELL} text-right font-mono`;

export default async function AiUsagePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!isInternalUser(user.email)) redirect("/clients");

  const [totals, byDay, recent] = await Promise.all([
    prisma.chatUsage.aggregate({
      _count: true,
      _sum: {
        inputTokens: true,
        outputTokens: true,
        cacheWriteTokens: true,
        cacheReadTokens: true,
        costUsd: true,
      },
    }),
    prisma.$queryRaw<DayRow[]>`
      SELECT
        to_char(("createdAt" AT TIME ZONE 'Europe/Bucharest')::date, 'YYYY-MM-DD') AS day,
        COUNT(*)::int AS requests,
        SUM("inputTokens")::int AS input_tokens,
        SUM("outputTokens")::int AS output_tokens,
        SUM("cacheReadTokens")::int AS cache_read_tokens,
        SUM("costUsd")::text AS cost_usd
      FROM "ChatUsage"
      GROUP BY 1
      ORDER BY 1 DESC
      LIMIT ${DAYS_SHOWN}
    `,
    prisma.chatUsage.findMany({
      orderBy: { createdAt: "desc" },
      take: REQUESTS_SHOWN,
    }),
  ]);

  const userIds = [...new Set(recent.map((r) => r.userId))];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, email: true },
  });
  const emailById = new Map(users.map((u) => [u.id, u.email]));

  const totalCost = Number(totals._sum.costUsd ?? 0);
  const totalIn = totals._sum.inputTokens ?? 0;
  const totalOut = totals._sum.outputTokens ?? 0;
  const totalCacheRead = totals._sum.cacheReadTokens ?? 0;
  const totalCacheWrite = totals._sum.cacheWriteTokens ?? 0;
  const cacheableInput = totalIn + totalCacheRead + totalCacheWrite;
  const cacheHitPct =
    cacheableInput > 0 ? Math.round((totalCacheRead / cacheableInput) * 100) : 0;

  const kpis = [
    { label: "Cost total", value: usd(totalCost) },
    { label: "Conversatii", value: totals._count.toLocaleString("ro-RO") },
    {
      label: "Cost mediu / conversatie",
      value: totals._count > 0 ? usd(totalCost / totals._count, 4) : "$0",
    },
    { label: "Tokens in / out", value: `${tok(totalIn + totalCacheRead + totalCacheWrite)} / ${tok(totalOut)}` },
    { label: "Cache hit", value: `${cacheHitPct}%` },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
      <h1
        className="text-[28px] font-semibold text-white"
        style={{ letterSpacing: "-0.04em" }}
      >
        Consum AI
      </h1>
      <p className="mt-2 text-[14px] text-gray" style={{ letterSpacing: "-0.02em" }}>
        Costul apelurilor Anthropic pentru chatul Costi. Inregistrarea a inceput
        pe 8 iulie 2026; istoricul anterior exista doar in consola Anthropic.
      </p>

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-5">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-dark-3 bg-dark-2 p-4">
            <div className="font-mono text-[11px] font-medium uppercase text-gray" style={{ letterSpacing: "-0.04em" }}>
              {k.label}
            </div>
            <div className="mt-1 font-mono text-lg text-white">{k.value}</div>
          </div>
        ))}
      </div>

      <h2 className="mt-10 text-[20px] font-semibold text-white" style={{ letterSpacing: "-0.04em" }}>
        Pe zile
      </h2>
      <div className="mt-3 overflow-x-auto rounded-xl border border-dark-3 bg-dark-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-dark-3 text-[0.6rem] uppercase tracking-wide text-gray">
              <th className={`${CELL} text-left`}>Zi</th>
              <th className={`${NUM}`}>Conversatii</th>
              <th className={`${NUM}`}>Tokens in</th>
              <th className={`${NUM}`}>Tokens out</th>
              <th className={`${NUM}`}>Cache read</th>
              <th className={`${NUM}`}>Cost</th>
            </tr>
          </thead>
          <tbody>
            {byDay.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-gray">
                  Nicio conversatie inregistrata inca.
                </td>
              </tr>
            )}
            {byDay.map((d) => (
              <tr key={d.day} className="border-b border-dark-3/50 hover:bg-dark-2/40">
                <td className={`${CELL} font-mono`}>{d.day}</td>
                <td className={NUM}>{d.requests}</td>
                <td className={NUM}>{tok(d.input_tokens)}</td>
                <td className={NUM}>{tok(d.output_tokens)}</td>
                <td className={NUM}>{tok(d.cache_read_tokens)}</td>
                <td className={NUM}>{usd(Number(d.cost_usd), 4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-10 text-[20px] font-semibold text-white" style={{ letterSpacing: "-0.04em" }}>
        Ultimele {REQUESTS_SHOWN} conversatii
      </h2>
      <div className="mt-3 overflow-x-auto rounded-xl border border-dark-3 bg-dark-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-dark-3 text-[0.6rem] uppercase tracking-wide text-gray">
              <th className={`${CELL} text-left`}>Cand</th>
              <th className={`${CELL} text-left`}>Utilizator</th>
              <th className={`${CELL} text-left`}>Model</th>
              <th className={NUM}>Runde</th>
              <th className={NUM}>In</th>
              <th className={NUM}>Out</th>
              <th className={NUM}>Cache</th>
              <th className={NUM}>Durata</th>
              <th className={NUM}>Cost</th>
            </tr>
          </thead>
          <tbody>
            {recent.length === 0 && (
              <tr>
                <td colSpan={9} className="py-6 text-center text-gray">
                  Nicio conversatie inregistrata inca.
                </td>
              </tr>
            )}
            {recent.map((r) => (
              <tr key={r.id} className="border-b border-dark-3/50 hover:bg-dark-2/40">
                <td className={`${CELL} whitespace-nowrap font-mono text-xs`}>
                  {r.createdAt.toLocaleString("ro-RO", {
                    timeZone: "Europe/Bucharest",
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
                <td className={`${CELL} max-w-[180px] truncate text-xs`}>
                  {emailById.get(r.userId) ?? r.userId}
                </td>
                <td className={`${CELL} whitespace-nowrap font-mono text-xs`}>
                  {r.model.replace("claude-", "")}
                </td>
                <td className={NUM}>{r.rounds}</td>
                <td className={NUM}>{tok(r.inputTokens)}</td>
                <td className={NUM}>{tok(r.outputTokens)}</td>
                <td className={NUM}>{tok(r.cacheReadTokens)}</td>
                <td className={NUM}>
                  {r.durationMs != null ? `${(r.durationMs / 1000).toFixed(1)}s` : "-"}
                </td>
                <td className={NUM}>{usd(Number(r.costUsd), 4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

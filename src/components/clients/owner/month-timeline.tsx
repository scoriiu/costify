"use client";

/**
 * MonthTimeline — "Luna de luna": one card per PUBLISHED month.
 *
 * Joins two sources that already travel to the page:
 *   - trends (frozen in the viewed snapshot): profit + cash numbers per month
 *   - the PublishedPeriod list: publish date + accountant note per month
 *
 * Months published but outside the 12-month trends window still get a card
 * (publish metadata only, no numbers). Clicking a card navigates the whole
 * page to that month's published snapshot via the existing ?year&month
 * mechanism, so the timeline doubles as the global month navigator.
 */

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { StickyNote } from "lucide-react";
import type { MonthlyTrendPoint } from "@/modules/reporting/owner";
import { lei, monthLabel } from "@/lib/owner-format";
import { Tooltip } from "@/components/ui/tooltip";
import { ChartInfo } from "./chart-info";

export interface PublishedMonthMeta {
  year: number;
  month: number;
  /** ISO string — serialized across the server/client boundary. */
  publishedAt: string;
  noteForOwner: string | null;
}

interface MonthTimelineProps {
  trends: MonthlyTrendPoint[];
  published: PublishedMonthMeta[];
  currentYear: number;
  currentMonth: number;
  limit?: number;
}

function formatPublishDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ro-RO", {
    day: "numeric",
    month: "short",
  });
}

export function MonthTimeline({
  trends,
  published,
  currentYear,
  currentMonth,
  limit = 12,
}: MonthTimelineProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (published.length === 0) return null;

  const trendByKey = new Map(trends.map((t) => [`${t.year}-${t.month}`, t]));
  const months = [...published]
    .sort((a, b) => b.year - a.year || b.month - a.month)
    .slice(0, limit)
    .reverse();

  function goTo(year: number, month: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("year", String(year));
    params.set("month", String(month));
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="rounded-xl border border-dark-3 bg-dark-2 p-5">
      <header>
        <h3
          className="inline-flex items-center gap-2 text-[15px] font-semibold text-white"
          style={{ letterSpacing: "-0.04em" }}
        >
          Luna de luna
          <ChartInfo text="Fiecare card e o luna pe care contabilul tau a publicat-o: castigul sau pierderea lunii (verde sau rosu), banii la final si data publicarii. Iconita de notita inseamna ca ai un mesaj de la contabil pentru luna aia. Apasa pe o luna ca sa incarci tot raportul ei." />
        </h3>
        <p className="mt-0.5 text-[11px] text-gray" style={{ letterSpacing: "-0.02em" }}>
          Fiecare luna pe care contabilul tau a publicat-o. Apasa pe o luna ca
          sa vezi tot raportul ei.
        </p>
      </header>

      <div
        className="mt-4 flex gap-3 overflow-x-auto pb-1 snap-x"
        data-testid="month-timeline"
      >
        {months.map((m) => {
          const trend = trendByKey.get(`${m.year}-${m.month}`);
          const isCurrent = m.year === currentYear && m.month === currentMonth;
          const profit = trend?.profit ?? null;
          return (
            <button
              key={`${m.year}-${m.month}`}
              type="button"
              onClick={() => !isCurrent && goTo(m.year, m.month)}
              aria-current={isCurrent ? "true" : undefined}
              className={`group relative w-[150px] shrink-0 snap-start rounded-xl border p-3.5 text-left transition-colors ${
                isCurrent
                  ? "border-primary/50 bg-primary/5"
                  : "border-dark-3 bg-dark-2 hover:border-primary/30 hover:bg-dark-2/60"
              }`}
            >
              <div className="flex items-start justify-between gap-1">
                <p
                  className="font-mono text-[10px] font-medium uppercase text-gray"
                  style={{ letterSpacing: "0.04em" }}
                >
                  {monthLabel(m.year, m.month)}
                </p>
                {m.noteForOwner && (
                  <Tooltip content={m.noteForOwner} side="top">
                    <span className="text-gray group-hover:text-gray-light">
                      <StickyNote size={12} aria-label="Nota de la contabil" />
                    </span>
                  </Tooltip>
                )}
              </div>

              <p
                className={`mt-2 font-mono text-[16px] font-semibold tabular-nums ${
                  profit === null ? "text-gray" : profit >= 0 ? "text-green" : "text-danger"
                }`}
                style={{ letterSpacing: "-0.04em" }}
              >
                {profit === null ? "—" : lei(profit)}
              </p>
              <p className="font-mono text-[10px] text-gray">
                {profit === null ? "in afara graficului" : profit >= 0 ? "castig" : "pierdere"}
              </p>

              {trend && (
                <p className="mt-2 font-mono text-[11px] text-gray-light tabular-nums">
                  {lei(trend.cashEnd)} <span className="text-gray">in banca</span>
                </p>
              )}

              <p className="mt-2 text-[10px] text-gray" style={{ letterSpacing: "-0.02em" }}>
                publicat pe {formatPublishDate(m.publishedAt)}
              </p>

              {isCurrent && (
                <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

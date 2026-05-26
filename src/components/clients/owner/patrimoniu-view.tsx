/**
 * PatrimoniuView — §12 Activ vs Pasiv full page.
 *
 * Two side-by-side columns:
 *   Activ  — Bunuri si echipamente, Stocuri, Creante, Cash, Cheltuieli avans
 *   Pasiv  — Capital, Profit/pierdere, Datorii LT, Datorii CT, Venituri avans
 *
 * Each bucket expands to show its contributing accounts.
 *
 * Top: a balance equation header showing Total Activ = Total Pasiv with a
 * verification badge. Non-zero difference is a data-quality issue surfaced
 * prominently — the patron sees there's something to fix.
 *
 * Bottom: donut showing share-of-activ and share-of-pasiv.
 */

"use client";

import { useState } from "react";
import type { Patrimoniu, PatrimoniuBucket } from "@/modules/reporting/owner";
import { lei } from "@/lib/owner-format";
import { ChevronDown } from "lucide-react";

const MONTH_NAMES = [
  "Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie",
  "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie",
];

interface PatrimoniuViewProps {
  data: Patrimoniu;
}

export function PatrimoniuView({ data }: PatrimoniuViewProps) {
  return (
    <div className="space-y-6">
      {/* Header strip with balance equation */}
      <div className="rounded-2xl border border-dark-3 bg-dark-2 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div>
            <span
              className="font-mono text-[10px] uppercase text-gray"
              style={{ letterSpacing: "0.08em" }}
            >
              La data de {MONTH_NAMES[data.asOfMonth - 1]} {data.asOfYear}
            </span>
            <h2
              className="mt-2 text-[20px] sm:text-[22px] font-semibold text-white"
              style={{ letterSpacing: "-0.04em" }}
            >
              Bilantul firmei
            </h2>
            <p
              className="mt-1 text-[13px] text-gray-light max-w-xl"
              style={{ letterSpacing: "-0.02em" }}
            >
              Ce detine firma (Activ) vs cum este finantata (Pasiv). Cele doua coloane sunt
              egale prin definitie — tot ce e in stanga are o sursa in dreapta.
            </p>
          </div>

          <BalanceCheck data={data} />
        </div>
      </div>

      {/* Equation tiles */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <PatrimoniuColumn
          title="Activ — ce detine firma"
          subtitle="Bunurile, banii, sumele de incasat."
          total={data.totalActiv}
          buckets={data.activ}
          tone="activ"
        />
        <PatrimoniuColumn
          title="Pasiv — de unde vin banii"
          subtitle="Capitalul tau, profitul cumulat, datoriile."
          total={data.totalPasiv}
          buckets={data.pasiv}
          tone="pasiv"
        />
      </div>

      {/* Structural breakdown */}
      <StructureBreakdown data={data} />
    </div>
  );
}

function BalanceCheck({ data }: { data: Patrimoniu }) {
  const fmtRon = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 0 });
  if (data.isBalanced) {
    return (
      <div className="inline-flex items-center gap-3 rounded-xl border border-green/30 bg-green/[0.08] px-4 py-3">
        <span
          className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-green/20 text-green font-mono text-[10px] font-semibold uppercase"
          style={{ letterSpacing: "0.04em" }}
        >
          OK
        </span>
        <div>
          <div
            className="font-mono text-[10px] uppercase text-green"
            style={{ letterSpacing: "0.04em" }}
          >
            Bilant verificat
          </div>
          <div
            className="font-mono text-[12px] text-gray-light tabular-nums"
            style={{ letterSpacing: "-0.02em" }}
          >
            Activ = Pasiv = {lei(data.totalActiv)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-3 rounded-xl border border-danger/30 bg-danger/[0.08] px-4 py-3">
      <span
        className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-danger/20 text-danger font-mono text-[10px] font-semibold uppercase"
        style={{ letterSpacing: "0.04em" }}
      >
        !
      </span>
      <div>
        <div
          className="font-mono text-[10px] uppercase text-danger"
          style={{ letterSpacing: "0.04em" }}
        >
          Diferenta de bilant
        </div>
        <div
          className="font-mono text-[12px] text-gray-light tabular-nums"
          style={{ letterSpacing: "-0.02em" }}
        >
          Activ − Pasiv = {fmtRon.format(data.difference)} lei
        </div>
      </div>
    </div>
  );
}

function PatrimoniuColumn({
  title,
  subtitle,
  total,
  buckets,
  tone,
}: {
  title: string;
  subtitle: string;
  total: number;
  buckets: PatrimoniuBucket[];
  tone: "activ" | "pasiv";
}) {
  const accentClass = tone === "activ" ? "text-primary" : "text-accent";
  const ringClass = tone === "activ" ? "border-primary/30" : "border-accent/30";
  const barColor = tone === "activ" ? "bg-primary" : "bg-accent";

  const nonZero = buckets.filter((b) => Math.abs(b.value) > 0.01);
  const maxBucket = nonZero.length > 0 ? Math.max(...nonZero.map((b) => Math.abs(b.value))) : 1;

  return (
    <div className={`rounded-2xl border bg-dark-2 p-5 sm:p-6 ${ringClass}`}>
      <div className="mb-5 flex items-baseline justify-between gap-3">
        <div>
          <h3
            className={`text-[16px] font-semibold ${accentClass}`}
            style={{ letterSpacing: "-0.04em" }}
          >
            {title}
          </h3>
          <p
            className="mt-1 text-[12px] text-gray-light"
            style={{ letterSpacing: "-0.02em" }}
          >
            {subtitle}
          </p>
        </div>
        <div className="text-right">
          <div
            className="font-mono text-[10px] uppercase text-gray"
            style={{ letterSpacing: "0.04em" }}
          >
            Total
          </div>
          <div
            className="font-mono text-[22px] font-semibold text-white tabular-nums"
            style={{ letterSpacing: "-0.04em" }}
          >
            {lei(total)}
          </div>
        </div>
      </div>

      {nonZero.length === 0 && (
        <div className="rounded-lg border border-dashed border-dark-3 bg-dark-3/20 p-6 text-center">
          <p className="text-[12px] text-gray-light" style={{ letterSpacing: "-0.02em" }}>
            Nicio valoare in aceasta categorie la data selectata.
          </p>
        </div>
      )}

      <ul className="space-y-2">
        {nonZero.map((bucket) => (
          <BucketRow key={bucket.id} bucket={bucket} maxBucket={maxBucket} barColor={barColor} totalForPercent={total} />
        ))}
      </ul>
    </div>
  );
}

function BucketRow({
  bucket,
  maxBucket,
  barColor,
  totalForPercent,
}: {
  bucket: PatrimoniuBucket;
  maxBucket: number;
  barColor: string;
  totalForPercent: number;
}) {
  const [open, setOpen] = useState(false);
  const widthPct = (Math.abs(bucket.value) / maxBucket) * 100;
  const sharePct = totalForPercent > 0 ? (Math.abs(bucket.value) / totalForPercent) * 100 : 0;

  return (
    <li className="rounded-xl border border-dark-3/60 bg-dark-3/30">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full p-4 text-left transition-colors hover:bg-dark-3/60 rounded-xl"
      >
        <div className="flex items-baseline justify-between gap-3 mb-1.5">
          <span
            className="text-[14px] font-medium text-white"
            style={{ letterSpacing: "-0.02em" }}
          >
            {bucket.label}
          </span>
          <div className="flex items-baseline gap-2 shrink-0">
            <span
              className="font-mono text-[16px] font-semibold text-white tabular-nums"
              style={{ letterSpacing: "-0.04em" }}
            >
              {lei(bucket.value)}
            </span>
            <span
              className="font-mono text-[10px] text-gray"
              style={{ letterSpacing: "0.04em" }}
            >
              {sharePct.toFixed(0)}%
            </span>
            <ChevronDown
              size={12}
              className={`text-gray ml-1 transition-transform ${open ? "rotate-180" : ""}`}
            />
          </div>
        </div>
        <div className="h-1.5 w-full rounded-full bg-dark-3 overflow-hidden mb-2">
          <div
            className={`h-full ${barColor} transition-all duration-500`}
            style={{ width: `${widthPct}%` }}
          />
        </div>
        <p
          className="text-[12px] text-gray-light"
          style={{ letterSpacing: "-0.02em" }}
        >
          {bucket.description}
        </p>
      </button>

      {open && (
        <div className="border-t border-dark-3/60 px-4 py-3">
          {bucket.items.length === 0 ? (
            <p className="text-[12px] text-gray" style={{ letterSpacing: "-0.02em" }}>
              Nicio inregistrare detaliata.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {bucket.items.map((item) => (
                <li
                  key={item.code}
                  className="flex items-baseline justify-between gap-3 text-[12px]"
                >
                  <div className="min-w-0 flex items-baseline gap-2">
                    <span
                      className="font-mono text-[10px] text-gray shrink-0"
                      style={{ letterSpacing: "0.04em" }}
                    >
                      {item.code}
                    </span>
                    <span
                      className="text-gray-light truncate"
                      style={{ letterSpacing: "-0.02em" }}
                    >
                      {item.label}
                    </span>
                  </div>
                  <span
                    className="font-mono text-white tabular-nums shrink-0"
                    style={{ letterSpacing: "-0.04em" }}
                  >
                    {lei(item.value)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

function StructureBreakdown({ data }: { data: Patrimoniu }) {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <DonutCard
        title="Structura Activ"
        subtitle="Cum se imparte ceea ce detine firma."
        buckets={data.activ}
        total={data.totalActiv}
        tone="activ"
      />
      <DonutCard
        title="Structura Pasiv"
        subtitle="Din ce surse vine finantarea firmei."
        buckets={data.pasiv}
        total={data.totalPasiv}
        tone="pasiv"
      />
    </div>
  );
}

const ACTIV_COLORS = [
  "var(--color-primary)",
  "var(--color-accent)",
  "var(--color-blue)",
  "var(--color-purple)",
  "var(--color-orange)",
];

const PASIV_COLORS = [
  "var(--color-accent)",
  "var(--color-primary)",
  "var(--color-purple)",
  "var(--color-orange)",
  "var(--color-blue)",
];

function DonutCard({
  title,
  subtitle,
  buckets,
  total,
  tone,
}: {
  title: string;
  subtitle: string;
  buckets: PatrimoniuBucket[];
  total: number;
  tone: "activ" | "pasiv";
}) {
  const palette = tone === "activ" ? ACTIV_COLORS : PASIV_COLORS;
  const nonZero = buckets.filter((b) => Math.abs(b.value) > 0.01);

  return (
    <div className="rounded-2xl border border-dark-3 bg-dark-2 p-5 sm:p-6">
      <h3 className="text-[16px] font-semibold text-white" style={{ letterSpacing: "-0.04em" }}>
        {title}
      </h3>
      <p className="mt-1 text-[12px] text-gray-light" style={{ letterSpacing: "-0.02em" }}>
        {subtitle}
      </p>

      {nonZero.length === 0 || total <= 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-dark-3 bg-dark-3/20 p-6 text-center">
          <p className="text-[12px] text-gray-light" style={{ letterSpacing: "-0.02em" }}>
            Nimic de afisat la data selectata.
          </p>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-[1fr_1fr] items-center gap-5">
          <Donut buckets={nonZero} total={total} palette={palette} />
          <ul className="space-y-2">
            {nonZero.map((b, idx) => {
              const pct = (Math.abs(b.value) / total) * 100;
              return (
                <li key={b.id} className="flex items-center gap-2 min-w-0">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ background: palette[idx % palette.length] }}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <div
                      className="text-[12px] text-gray-light truncate"
                      style={{ letterSpacing: "-0.02em" }}
                    >
                      {b.label}
                    </div>
                  </div>
                  <span
                    className="font-mono text-[11px] font-semibold text-white tabular-nums"
                    style={{ letterSpacing: "-0.04em" }}
                  >
                    {pct.toFixed(0)}%
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function Donut({
  buckets,
  total,
  palette,
}: {
  buckets: PatrimoniuBucket[];
  total: number;
  palette: string[];
}) {
  const size = 160;
  const center = size / 2;
  const radius = 64;
  const innerRadius = 42;

  let cumulative = 0;
  const slices = buckets.map((b, idx) => {
    const value = Math.abs(b.value);
    const startAngle = (cumulative / total) * 2 * Math.PI;
    cumulative += value;
    const endAngle = (cumulative / total) * 2 * Math.PI;
    return {
      path: arcPath(center, center, radius, innerRadius, startAngle, endAngle),
      color: palette[idx % palette.length],
      label: b.label,
    };
  });

  return (
    <div className="relative h-40 w-40 mx-auto">
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90">
        {slices.map((s, idx) => (
          <path key={idx} d={s.path} fill={s.color} stroke="var(--color-dark-2)" strokeWidth={2} />
        ))}
      </svg>
    </div>
  );
}

function arcPath(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startAngle: number,
  endAngle: number
): string {
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  const x1 = cx + rOuter * Math.cos(startAngle);
  const y1 = cy + rOuter * Math.sin(startAngle);
  const x2 = cx + rOuter * Math.cos(endAngle);
  const y2 = cy + rOuter * Math.sin(endAngle);
  const x3 = cx + rInner * Math.cos(endAngle);
  const y3 = cy + rInner * Math.sin(endAngle);
  const x4 = cx + rInner * Math.cos(startAngle);
  const y4 = cy + rInner * Math.sin(startAngle);
  return [
    `M ${x1} ${y1}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${x2} ${y2}`,
    `L ${x3} ${y3}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${x4} ${y4}`,
    "Z",
  ].join(" ");
}

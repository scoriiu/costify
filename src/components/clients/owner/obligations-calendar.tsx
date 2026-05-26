/**
 * ObligationsCalendar — §11 upcoming dues (TVA, salarii, contributii, impozit).
 *
 * Deterministic from the snapshot: each obligation has a label, due date,
 * amount, days until due, and a one-line hint. Sorted ascending by due date
 * so the most urgent thing is at top.
 *
 * Visual cues:
 *   - past due  → danger red
 *   - 0-7 days  → warning amber
 *   - 8-30 days → primary teal
 *   - >30 days  → neutral gray
 */

import type { ObligationEntry } from "@/modules/reporting/owner";
import { lei } from "@/lib/owner-format";

const MONTH_NAMES_SHORT = [
  "Ian", "Feb", "Mar", "Apr", "Mai", "Iun",
  "Iul", "Aug", "Sep", "Oct", "Noi", "Dec",
];

function urgencyTone(daysUntil: number): {
  bar: string;
  badge: string;
  tag: string;
  text: string;
} {
  if (daysUntil < 0) {
    return {
      bar: "bg-danger",
      badge: "bg-danger/15 text-danger",
      tag: "Restant",
      text: "text-danger",
    };
  }
  if (daysUntil <= 7) {
    return {
      bar: "bg-warn",
      badge: "bg-warn/15 text-warn",
      tag: daysUntil === 0 ? "Astazi" : `${daysUntil} zile`,
      text: "text-warn",
    };
  }
  if (daysUntil <= 30) {
    return {
      bar: "bg-primary",
      badge: "bg-primary/15 text-primary",
      tag: `${daysUntil} zile`,
      text: "text-white",
    };
  }
  return {
    bar: "bg-gray",
    badge: "bg-dark-3 text-gray-light",
    tag: `${daysUntil} zile`,
    text: "text-white",
  };
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return `${d.getDate()} ${MONTH_NAMES_SHORT[d.getMonth()]}`;
}

interface ObligationsCalendarProps {
  items: ObligationEntry[];
}

export function ObligationsCalendar({ items }: ObligationsCalendarProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dark-3 bg-dark-2 p-5 sm:p-6">
        <Header />
        <div className="mt-4 rounded-lg border border-dashed border-dark-3 bg-dark-3/20 p-6 text-center">
          <p className="text-[13px] text-gray-light" style={{ letterSpacing: "-0.02em" }}>
            Nicio obligatie scadenta detectata. Datele sunt din ultima balanta inchisa.
          </p>
        </div>
      </div>
    );
  }

  const totalAmount = items.reduce((s, i) => s + i.amount, 0);

  return (
    <div className="rounded-2xl border border-dark-3 bg-dark-2 p-5 sm:p-6">
      <Header />

      <div className="mt-4 mb-5 flex items-baseline justify-between gap-3 border-b border-dark-3 pb-3">
        <span
          className="font-mono text-[10px] uppercase text-gray"
          style={{ letterSpacing: "0.04em" }}
        >
          Total de platit
        </span>
        <span
          className="font-mono text-[18px] font-semibold text-white tabular-nums"
          style={{ letterSpacing: "-0.04em" }}
        >
          {lei(totalAmount)}
        </span>
      </div>

      <ul className="space-y-2">
        {items.map((item) => {
          const tone = urgencyTone(item.daysUntil);
          return (
            <li
              key={item.id}
              className="relative overflow-hidden rounded-xl border border-dark-3/60 bg-dark-3/30 p-4 pl-5"
            >
              <span className={`absolute left-0 top-0 h-full w-[3px] ${tone.bar}`} aria-hidden />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="text-[14px] font-medium text-white"
                      style={{ letterSpacing: "-0.02em" }}
                    >
                      {item.label}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${tone.badge}`}
                      style={{ letterSpacing: "0.04em" }}
                    >
                      {tone.tag}
                    </span>
                  </div>
                  <p
                    className="text-[12px] text-gray-light"
                    style={{ letterSpacing: "-0.02em" }}
                  >
                    {item.hint}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <div
                    className={`font-mono text-[16px] font-semibold tabular-nums ${tone.text}`}
                    style={{ letterSpacing: "-0.04em" }}
                  >
                    {lei(item.amount)}
                  </div>
                  <div
                    className="font-mono text-[10px] uppercase text-gray mt-0.5"
                    style={{ letterSpacing: "0.04em" }}
                  >
                    {formatDate(item.dueDate)}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Header() {
  return (
    <div>
      <h3
        className="text-[16px] font-semibold text-white"
        style={{ letterSpacing: "-0.04em" }}
      >
        Ce ai de platit in urmatoarele saptamani
      </h3>
      <p
        className="mt-1 text-[12px] text-gray-light"
        style={{ letterSpacing: "-0.02em" }}
      >
        Detectate automat din sold: TVA scadent, salarii, contributii, impozit pe profit.
      </p>
    </div>
  );
}

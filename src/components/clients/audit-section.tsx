import { History } from "lucide-react";
import type { AccountantAuditRow } from "@/modules/audit";

interface Props {
  rows: AccountantAuditRow[];
}

const MS_PER_MIN = 60_000;
const MS_PER_HR = 3_600_000;
const MS_PER_DAY = 86_400_000;

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  if (diff < MS_PER_MIN) return "acum cateva secunde";
  if (diff < MS_PER_HR) return `acum ${Math.round(diff / MS_PER_MIN)} min`;
  if (diff < MS_PER_DAY) return `acum ${Math.round(diff / MS_PER_HR)} h`;
  if (diff < 7 * MS_PER_DAY) return `acum ${Math.round(diff / MS_PER_DAY)} zile`;
  return date.toLocaleDateString("ro-RO", { day: "numeric", month: "short", year: "numeric" });
}

export function AuditSection({ rows }: Props) {
  return (
    <section
      className="rounded-xl border border-dark-3 bg-dark-2 p-5 sm:p-6"
      data-testid="setari-istoric"
    >
      <header>
        <div className="flex items-center gap-2.5">
          <History size={16} className="text-primary" />
          <h2
            className="text-[16px] font-semibold text-white"
            style={{ letterSpacing: "-0.04em" }}
          >
            Istoric actiuni
          </h2>
        </div>
        <p
          className="mt-1.5 text-[12px] text-gray"
          style={{ letterSpacing: "-0.02em" }}
        >
          Toate modificarile inregistrate pe aceasta firma — publicari, importuri, schimbari de regim fiscal, accese.
        </p>
      </header>

      {rows.length === 0 ? (
        <p
          className="mt-5 text-[13px] text-gray"
          style={{ letterSpacing: "-0.02em" }}
        >
          Nicio actiune inregistrata pana acum.
        </p>
      ) : (
        <ul className="mt-5 divide-y divide-dark-3">
          {rows.map((row) => (
            <li key={row.id} className="py-3 flex items-start gap-3">
              <div
                className="font-mono text-[10px] uppercase tracking-wider text-gray shrink-0 w-24 pt-0.5"
                title={row.createdAt.toLocaleString("ro-RO")}
              >
                {timeAgo(row.createdAt)}
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className="text-[13px] text-gray-light"
                  style={{ letterSpacing: "-0.02em" }}
                >
                  <span className="font-medium text-white">{row.actorName}</span>{" "}
                  {row.description}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

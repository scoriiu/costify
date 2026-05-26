import type { OwnerAuditRow } from "@/modules/audit";

interface Props {
  rows: OwnerAuditRow[];
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
  return date.toLocaleDateString("ro-RO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function OwnerHistoryList({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-dark-3 bg-dark-2/50 p-8 sm:p-10">
        <p
          className="text-[14px] text-gray-light"
          style={{ letterSpacing: "-0.02em" }}
        >
          Niciun eveniment inregistrat pana acum. Cand contabilul tau publica o
          luna noua sau face modificari, le vei vedea aici.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-dark-3 bg-dark-2 p-5 sm:p-6">
      <ul className="divide-y divide-dark-3">
        {rows.map((row) => (
          <li key={row.id} className="py-3 flex items-start gap-3">
            <div
              className="font-mono text-[10px] uppercase tracking-wider text-gray shrink-0 w-24 pt-0.5"
              title={row.createdAt.toLocaleString("ro-RO")}
            >
              {timeAgo(row.createdAt)}
            </div>
            <p
              className="text-[14px] text-gray-light flex-1 min-w-0"
              style={{ letterSpacing: "-0.02em" }}
            >
              {row.description}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

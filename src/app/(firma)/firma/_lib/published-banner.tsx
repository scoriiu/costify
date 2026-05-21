/**
 * Discreet banner at the top of /firma showing which period was published and
 * when. Reinforces "this is what your accountant signed off on" for the patron.
 *
 * For accountant preview (?as=), the `stale` flag is honored and adds a small
 * warning chip "Jurnalul s-a modificat de la ultima publicare".
 */

const MONTH_NAMES = [
  "ianuarie",
  "februarie",
  "martie",
  "aprilie",
  "mai",
  "iunie",
  "iulie",
  "august",
  "septembrie",
  "octombrie",
  "noiembrie",
  "decembrie",
];

function formatRoDate(d: Date): string {
  return d.toLocaleDateString("ro-RO", { day: "numeric", month: "long", year: "numeric" });
}

interface Props {
  year: number;
  month: number;
  publishedAt: Date;
  publisherName: string | null;
  noteForOwner: string | null;
  stale: boolean;
}

export function PublishedPeriodBanner({
  year,
  month,
  publishedAt,
  publisherName,
  noteForOwner,
  stale,
}: Props) {
  const monthName = MONTH_NAMES[month - 1];
  const by = publisherName ? ` de ${publisherName}` : "";
  return (
    <div className="mb-8 rounded-xl border border-dark-3 bg-dark-2/50 px-4 py-3 sm:px-5 sm:py-3.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span
          className="font-mono text-[11px] font-medium uppercase tracking-wider text-primary-light"
          aria-hidden
        >
          Date publicate
        </span>
        <span
          className="text-[13px] text-gray-light"
          style={{ letterSpacing: "-0.02em" }}
        >
          {monthName} {year} · publicat{by} pe {formatRoDate(publishedAt)}
        </span>
        {stale && (
          <span
            className="font-mono text-[10px] font-medium uppercase tracking-wider text-tone-warn border border-tone-warn-border bg-tone-warn-bg px-1.5 py-0.5 rounded"
            title="Jurnalul s-a modificat dupa publicare. Contabilul poate re-publica."
          >
            Necesita re-publicare
          </span>
        )}
      </div>
      {noteForOwner && (
        <p
          className="mt-1.5 text-[12px] text-gray"
          style={{ letterSpacing: "-0.02em" }}
        >
          {noteForOwner}
        </p>
      )}
    </div>
  );
}

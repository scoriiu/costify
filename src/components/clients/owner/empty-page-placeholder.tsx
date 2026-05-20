/**
 * Placeholder for owner sub-pages that haven't been built yet.
 *
 * Shows the PageHeader (so navigation feels live) plus a friendly note that
 * the page is coming soon. Disappears as we build each real page.
 */

import { PageHeader } from "./page-header";

interface Props {
  title: string;
  subtitle: string;
  /** What the entrepreneur will see here, in plain language. */
  preview: string[];
}

export function EmptyPagePlaceholder({ title, subtitle, preview }: Props) {
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <div className="rounded-xl border border-dashed border-dark-3 bg-dark-2/50 p-8 sm:p-12">
        <div className="max-w-md">
          <p
            className="font-mono text-[10px] uppercase tracking-wider text-primary mb-3"
            style={{ letterSpacing: "0.05em" }}
          >
            In curand
          </p>
          <p
            className="text-[14px] text-gray-light leading-relaxed mb-5"
            style={{ letterSpacing: "-0.02em" }}
          >
            Aceasta pagina nu e gata inca. Iata ce vei vedea aici:
          </p>
          <ul className="space-y-2">
            {preview.map((item, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-[13px] text-gray-light"
                style={{ letterSpacing: "-0.02em" }}
              >
                <span className="text-primary mt-0.5">·</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}

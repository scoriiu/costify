import Link from "next/link";
import { ArrowLeft, AlertCircle } from "lucide-react";

/**
 * Rendered by the firma showcase pages when SHOWCASE_CLIENT_SLUG is unset or
 * the slug doesn't resolve to an active client with journal data. This is a
 * config issue, not a runtime error — show a clear hint instead of a 500.
 */
export function ShowcaseUnconfigured() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-8 sm:py-16">
      <Link
        href="/internal/firma"
        className="mb-6 inline-flex items-center gap-1.5 text-[13px] text-gray-light hover:text-white transition-colors"
      >
        <ArrowLeft size={14} /> Inapoi la specs
      </Link>

      <div className="rounded-xl border border-warn/30 bg-warn/[0.06] p-6">
        <div className="flex items-start gap-3">
          <AlertCircle size={20} className="text-warn mt-0.5 shrink-0" />
          <div>
            <h2
              className="text-[18px] font-semibold text-white"
              style={{ letterSpacing: "-0.04em" }}
            >
              Showcase neconfigurat
            </h2>
            <p
              className="mt-2 text-[14px] text-gray-light leading-relaxed"
              style={{ letterSpacing: "-0.02em" }}
            >
              Adauga in <code className="font-mono text-white">.env</code> sau
              <code className="font-mono text-white"> .env.local</code>:
            </p>
            <pre className="mt-3 rounded-lg border border-dark-3 bg-dark-2 px-4 py-3 font-mono text-[12px] text-gray-light overflow-x-auto">
{`SHOWCASE_CLIENT_SLUG=slug-firmei-tale
# optional, defaults to latest available period:
SHOWCASE_PERIOD=2026-04`}
            </pre>
            <p
              className="mt-3 text-[12px] text-gray leading-relaxed"
              style={{ letterSpacing: "-0.02em" }}
            >
              Slug-ul trebuie sa apartina unei firme active cu jurnal incarcat.
              Perioada e optionala — daca lipseste, se foloseste cea mai
              recenta luna cu date.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

import { getSessionUser } from "@/modules/auth/session";
import { redirect } from "next/navigation";
import { isInternalUser } from "@/lib/internal-access";
import latestRun from "@/modules/costi/golden/latest-run.json";

interface RunCheck {
  id: string;
  level: string;
  ok: boolean;
  detail: string;
}

interface RunCase {
  id: string;
  title: string;
  question: string;
  page: string;
  ownerReview: boolean;
  status: string;
  error: string | null;
  checks: RunCheck[];
  toolNames: string[];
  stopReason: string | null;
  durationMs: number;
  costUsd: number;
  answer: string;
}

const STATUS_STYLE: Record<string, string> = {
  pass: "bg-green/10 text-green border-green/30",
  fail: "bg-danger/10 text-danger border-danger/30",
  error: "bg-orange/10 text-orange border-orange/30",
};

function voiceOf(page: string): string {
  return page.includes("view=owner") ? "patron" : page.includes("/clients/") ? "contabil" : "general";
}

export default async function GoldenSetPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!isInternalUser(user.email)) redirect("/clients");

  const run = latestRun as {
    ranAt: string;
    durationMs: number;
    totals: { cases: number; passed: number; costUsd: number };
    cases: RunCase[];
  };

  const kpis = [
    { label: "Cazuri", value: `${run.totals.passed}/${run.totals.cases} pass` },
    {
      label: "Ultima rulare",
      value: new Date(run.ranAt).toLocaleString("ro-RO", {
        timeZone: "Europe/Bucharest",
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }),
    },
    { label: "Durata", value: `${Math.round(run.durationMs / 60000)}min` },
    { label: "Cost rulare", value: `$${run.totals.costUsd.toFixed(2)}` },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
      <h1 className="text-[28px] font-semibold text-white" style={{ letterSpacing: "-0.04em" }}>
        Golden Set — Costi
      </h1>
      <p className="mt-2 max-w-3xl text-[14px] text-gray" style={{ letterSpacing: "-0.02em" }}>
        Setul de intrebari de aur care pazeste calitatea lui Costi: fiecare caz e o
        intrebare canonica rulata pe datele reale QHM21 (baza locala de dev), verificata
        determinist (garda de jargon, ordinea tool-urilor, onestitatea memoriei, ancore
        numerice). Ruleaza local cu <code className="rounded bg-dark-3 px-1.5 py-0.5 font-mono text-xs">pnpm golden</code>;
        rezultatul de mai jos e ultimul commit al artefactului.
      </p>

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-dark-3 bg-dark-2 p-4">
            <div className="font-mono text-[11px] font-medium uppercase text-gray" style={{ letterSpacing: "-0.04em" }}>
              {k.label}
            </div>
            <div className="mt-1 font-mono text-lg text-white">{k.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-10 space-y-3">
        {run.cases.map((c, i) => {
          const failed = c.checks.filter((ch) => !ch.ok);
          return (
            <details key={c.id} className="group rounded-xl border border-dark-3 bg-dark-2">
              <summary className="flex flex-wrap items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
                <span className="font-mono text-xs text-gray">{String(i + 1).padStart(2, "0")}</span>
                <span
                  className={`rounded-md border px-2 py-0.5 font-mono text-[11px] uppercase ${STATUS_STYLE[c.status] ?? ""}`}
                >
                  {c.status}
                </span>
                <span className="flex-1 text-sm font-semibold text-white" style={{ letterSpacing: "-0.02em" }}>
                  {c.title}
                </span>
                <span className="font-mono text-[11px] uppercase text-gray">{voiceOf(c.page)}</span>
                <span className="font-mono text-xs text-gray">
                  {(c.durationMs / 1000).toFixed(0)}s · ${c.costUsd.toFixed(3)}
                </span>
              </summary>

              <div className="border-t border-dark-3/50 p-4">
                <div className="font-mono text-[11px] font-medium uppercase text-gray">Intrebare</div>
                <p className="mt-1 text-sm text-white">{c.question}</p>

                <div className="mt-3 font-mono text-[11px] font-medium uppercase text-gray">
                  Tool-uri: <span className="normal-case text-gray-light">{c.toolNames.join(", ") || "niciunul"}</span>
                </div>

                {failed.length > 0 && (
                  <div className="mt-3 rounded-lg border border-danger/20 bg-danger/5 p-3">
                    {failed.map((ch) => (
                      <div key={ch.id} className="font-mono text-xs text-danger">
                        [{ch.level}] {ch.id}: {ch.detail}
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-3 font-mono text-[11px] font-medium uppercase text-gray">
                  Raspunsul lui Costi
                </div>
                <pre className="mt-1 max-h-96 overflow-y-auto whitespace-pre-wrap rounded-lg border border-dark-3 bg-dark p-3 text-xs leading-relaxed text-gray-light scrollbar-thin">
                  {c.error ? `EROARE: ${c.error}` : c.answer}
                </pre>

                <div className="mt-2 font-mono text-[11px] text-gray">
                  {c.checks.filter((ch) => ch.ok).length}/{c.checks.length} verificari ·
                  stop: {c.stopReason ?? "?"} · pagina: {c.page}
                  {c.ownerReview ? " · inclus in validarea patronului" : ""}
                </div>
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}

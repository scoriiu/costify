/**
 * Conceptual diagrams used in the cashflow docs. These are NOT screenshots
 * of the UI — they are visual explainers (axis × axis, resolution flow,
 * data lineage). Kept light, no animations, pure layout + typography.
 */

import { MockLabelMono } from "./primitives";

export function MockAxesDiagram() {
  return (
    <div className="rounded-xl border border-dark-3 bg-dark-2 p-6">
      <div className="text-center mb-6">
        <div className="text-[12px] text-gray" style={{ letterSpacing: "-0.02em" }}>
          QHM21 NETWORK SRL — aprilie 2026
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto_1fr] gap-4 items-stretch">
        <AxisCard
          label="Axa A — Categorii"
          subtitle="Natura cheltuielii"
          items={["Salarii", "Servicii externe", "Electricitate", "Chirie", "Marfa", "Taxe"]}
        />
        <div className="hidden md:flex items-center justify-center">
          <span className="text-[24px] text-primary font-mono">×</span>
        </div>
        <AxisCard
          label="Axa B — Verticale"
          subtitle="Linii de business"
          items={["Outsourcing", "Recruitment", "Coworking", "Toata firma"]}
        />
        <div className="hidden md:flex items-center justify-center">
          <span className="text-[24px] text-primary font-mono">=</span>
        </div>
        <AxisCard
          label="Owner view"
          subtitle="Pe /firma"
          items={[
            "Outsourcing: 70k profit",
            "Recruitment: 20k profit",
            "Coworking: 5k profit",
            "Toata firma: 2k profit",
          ]}
          accent
        />
      </div>

      <div className="mt-4 text-center text-[11px] text-gray italic" style={{ letterSpacing: "-0.02em" }}>
        Cele doua axe sunt independente. Aceeasi cheltuiala apare pe ambele simultan.
      </div>
    </div>
  );
}

function AxisCard({
  label,
  subtitle,
  items,
  accent,
}: {
  label: string;
  subtitle: string;
  items: string[];
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        accent ? "border-primary/40 bg-primary/5" : "border-dark-3"
      }`}
    >
      <div className="text-center mb-3">
        <div className="font-mono text-[10px] uppercase tracking-wider text-primary">
          {label}
        </div>
        <div className="text-[11px] text-gray mt-0.5" style={{ letterSpacing: "-0.02em" }}>
          {subtitle}
        </div>
      </div>
      <ul className="space-y-1">
        {items.map((it) => (
          <li
            key={it}
            className="text-[12px] text-gray-light text-center"
            style={{ letterSpacing: "-0.02em" }}
          >
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MockTwoLanguagesTable() {
  const rows = [
    { contabil: "Conturile clasa 641, 645", patron: "Salarii si contributii" },
    { contabil: "Conturile 605, 604", patron: "Energie, apa, intretinere" },
    { contabil: "Contul 7011", patron: "Vanzari" },
    { contabil: "Contul 411.NOLICH (sold debitor 23k)", patron: "NOLICH SRL iti datoreaza 23.000 lei" },
    { contabil: "Cont 401.MONT BLANC (sold creditor 12k)", patron: "Datorezi catre MONT BLANC 12.000 lei" },
  ];
  return (
    <div className="rounded-xl border border-dark-3 overflow-hidden">
      <div className="grid grid-cols-2 bg-dark-2">
        <div className="px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-gray border-r border-dark-3">
          In limbajul contabilului
        </div>
        <div className="px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-primary">
          In limbajul antreprenorului
        </div>
      </div>
      <div className="divide-y divide-dark-3">
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-2 text-[13px]">
            <div className="px-4 py-2 text-gray-light border-r border-dark-3 font-mono text-[12px]">
              {r.contabil}
            </div>
            <div className="px-4 py-2 text-white" style={{ letterSpacing: "-0.02em" }}>
              {r.patron}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MockResolutionFlow() {
  return (
    <div className="rounded-xl border border-dark-3 bg-dark-2 p-5">
      <MockLabelMono>Rezolvarea unei mapari pentru contul 628.01.NOLICH</MockLabelMono>
      <div className="mt-4 flex flex-col gap-3">
        <FlowStep
          n={1}
          question="Exista mapare analitica pentru 628.01.NOLICH?"
          yes="Foloseste mapare analitica → categoria si verticala specificate explicit"
          no="Trece la urmatorul pas"
        />
        <FlowArrow />
        <FlowStep
          n={2}
          question="Exista mapare contBase pentru 628?"
          yes="Foloseste maparea de baza → toate conturile 628.xx mostenesc categoria si verticala"
          no="Trece la urmatorul pas"
        />
        <FlowArrow />
        <FlowStep
          n={3}
          question="Niciuna nu exista"
          yes={null}
          no={null}
          tone="danger"
          terminal="NEMAPAT — apare cu badge rosu in Pasul 3, asteapta interventie contabil"
        />
      </div>
    </div>
  );
}

function FlowStep({
  n,
  question,
  yes,
  no,
  tone,
  terminal,
}: {
  n: number;
  question: string;
  yes: string | null;
  no: string | null;
  tone?: "danger";
  terminal?: string;
}) {
  const border = tone === "danger" ? "border-danger/40" : "border-dark-3";
  return (
    <div className={`rounded-lg border ${border} p-3`}>
      <div className="flex items-start gap-2 mb-2">
        <span className="font-mono text-[10px] bg-dark-3 px-1.5 py-0.5 rounded text-gray-light shrink-0">
          PAS {n}
        </span>
        <span className="text-[13px] text-white" style={{ letterSpacing: "-0.02em" }}>
          {question}
        </span>
      </div>
      {yes && (
        <div className="flex items-start gap-2 text-[12px] pl-12 mb-1">
          <span className="font-mono text-green text-[10px] uppercase tracking-wider mt-0.5">Da</span>
          <span className="text-gray-light flex-1" style={{ letterSpacing: "-0.02em" }}>{yes}</span>
        </div>
      )}
      {no && (
        <div className="flex items-start gap-2 text-[12px] pl-12">
          <span className="font-mono text-gray text-[10px] uppercase tracking-wider mt-0.5">Nu</span>
          <span className="text-gray-light flex-1" style={{ letterSpacing: "-0.02em" }}>{no}</span>
        </div>
      )}
      {terminal && (
        <div className="pl-12 text-[12px] text-danger" style={{ letterSpacing: "-0.02em" }}>
          {terminal}
        </div>
      )}
    </div>
  );
}

function FlowArrow() {
  return (
    <div className="flex justify-center">
      <span className="text-[18px] text-gray">↓</span>
    </div>
  );
}

export function MockSplitMath() {
  const rows = [
    { vertical: "Outsourcing", pct: 70, amount: "35.000 lei" },
    { vertical: "Recruitment", pct: 30, amount: "15.000 lei" },
  ];
  return (
    <div className="rounded-xl border border-dark-3 bg-dark-2 p-5">
      <div className="flex items-baseline justify-between mb-4">
        <MockLabelMono>Cum se aplica splitul matematic</MockLabelMono>
        <span className="font-mono text-[12px] text-gray">cont 641, rulaj 50.000 lei</span>
      </div>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.vertical} className="flex items-center gap-3 rounded-lg border border-dark-3 px-3 py-2">
            <div className="flex-1 text-[13px] text-white" style={{ letterSpacing: "-0.02em" }}>
              {r.vertical}
            </div>
            <span className="font-mono text-[12px] text-gray">{r.pct}% × 50.000</span>
            <span className="font-mono text-[12px] text-primary">=</span>
            <span className="font-mono text-[13px] text-white tabular-nums w-24 text-right">{r.amount}</span>
          </div>
        ))}
        <div className="flex items-center gap-3 px-3 py-2 border-t border-dark-3 mt-1">
          <span className="flex-1 text-[11px] uppercase font-mono tracking-wider text-gray">Total</span>
          <span className="font-mono text-[13px] text-green tabular-nums w-24 text-right">50.000 lei</span>
        </div>
      </div>
      <p className="mt-3 text-[11px] text-gray italic" style={{ letterSpacing: "-0.02em" }}>
        Ultimul slice primeste remainder-ul rotunjirii ca totalul sa fie exact.
      </p>
    </div>
  );
}

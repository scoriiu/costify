/**
 * Mockups specific to the Mapari Cashflow / configuration flow:
 *   - Three-step layout overview
 *   - Account row from Pasul 3
 *   - Split allocation popover
 *   - Activate verticals modal
 */

import { MockSurface, MockLabelMono, MockBanner } from "./primitives";

export function MockMapariFlow() {
  const steps = [
    {
      n: 1,
      title: "Cum se grupeaza cheltuielile si veniturile",
      optional: true,
      collapsed: true,
      summary: "10 categorii cheltuieli · 6 venituri — toate sunt defaults OMFP. Click pentru a personaliza.",
    },
    {
      n: 2,
      title: "Verticale de business",
      optional: true,
      summary: "Linii de business pe care le urmaresti separat (Outsourcing, Recruitment, Coworking).",
    },
    {
      n: 3,
      title: "Mapeaza conturile",
      summary: "Aloca fiecare cont la o categorie si optional la o verticala.",
    },
  ];
  return (
    <div className="space-y-3">
      {steps.map((s) => (
        <MockSurface key={s.n}>
          <div className="flex items-baseline gap-3 mb-2">
            <MockLabelMono>Pasul {s.n}</MockLabelMono>
            <span className="text-[15px] font-semibold text-white" style={{ letterSpacing: "-0.04em" }}>
              {s.title}
            </span>
            {s.optional && <MockLabelMono>optional</MockLabelMono>}
            {s.collapsed && (
              <span className="ml-auto text-[11px] text-primary">Personalizeaza ▾</span>
            )}
          </div>
          <p className="text-[12px] text-gray-light" style={{ letterSpacing: "-0.02em" }}>
            {s.summary}
          </p>
        </MockSurface>
      ))}
    </div>
  );
}

export function MockAccountRow() {
  return (
    <MockSurface>
      <MockLabelMono>Pasul 3 — un rand din tabel</MockLabelMono>
      <div className="mt-3 grid grid-cols-[110px_1fr_1fr_1fr_110px] gap-3 items-center text-[13px]">
        <div>
          <div className="font-mono text-white">628.01</div>
          <div className="text-[11px] text-gray">NOLICH SRL</div>
        </div>
        <div className="text-gray-light" style={{ letterSpacing: "-0.02em" }}>
          Servicii externe
          <div className="text-[10px] text-gray font-mono uppercase tracking-wider mt-0.5">categorie</div>
        </div>
        <div className="text-gray-light" style={{ letterSpacing: "-0.02em" }}>
          Outsourcing <span className="text-[10px] text-primary">100%</span>
          <div className="text-[10px] text-gray font-mono uppercase tracking-wider mt-0.5">verticala</div>
        </div>
        <div>
          <span className="inline-flex items-center rounded-full bg-primary/10 border border-primary/30 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-primary">
            individual
          </span>
          <div className="text-[10px] text-gray font-mono uppercase tracking-wider mt-0.5">scope</div>
        </div>
        <div className="text-right">
          <div className="font-mono tabular-nums text-white">23.451 lei</div>
          <div className="text-[10px] text-gray font-mono uppercase tracking-wider">rulaj luna</div>
        </div>
      </div>
    </MockSurface>
  );
}

export function MockSplitPopover() {
  const splits = [
    { name: "Outsourcing", pct: 70 },
    { name: "Recruitment", pct: 30 },
  ];
  return (
    <div className="max-w-md rounded-xl border border-dark-3 bg-dark-2 shadow-2xl p-5">
      <div className="mb-3">
        <div className="text-[14px] font-semibold text-white" style={{ letterSpacing: "-0.04em" }}>
          Imparte intre verticale
        </div>
        <div className="text-[11px] text-gray mt-1">Cont 641 — Salarii si contributii</div>
      </div>
      <div className="space-y-3">
        {splits.map((s) => (
          <div key={s.name}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[13px] text-gray-light" style={{ letterSpacing: "-0.02em" }}>
                {s.name}
              </span>
              <span className="font-mono text-[12px] text-white tabular-nums">{s.pct} %</span>
            </div>
            <div className="h-1.5 rounded-full bg-dark-3 overflow-hidden">
              <div className="h-full bg-primary/70" style={{ width: `${s.pct}%` }} />
            </div>
          </div>
        ))}
        <button className="text-[12px] text-primary hover:text-primary-light">
          + adauga verticala
        </button>
      </div>
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-dark-3">
        <span className="text-[11px] text-gray">Total: <span className="text-green font-mono">100%</span></span>
        <div className="flex gap-2">
          <button className="text-[12px] text-gray hover:text-gray-light px-3 py-1">Renunta</button>
          <button className="text-[12px] text-white bg-primary hover:bg-primary-dark rounded-[10px] px-3 py-1">Salveaza</button>
        </div>
      </div>
    </div>
  );
}

export function MockActivateModal() {
  return (
    <div className="max-w-lg rounded-xl border border-dark-3 bg-dark-2 shadow-2xl p-6">
      <div className="text-[16px] font-semibold text-white mb-2" style={{ letterSpacing: "-0.04em" }}>
        Configureaza verticalele firmei
      </div>
      <p className="text-[12px] text-gray-light mb-4" style={{ letterSpacing: "-0.02em" }}>
        Scrie numele liniilor de business pe care vrei sa le urmaresti. Vor aparea pe /firma sub
        &quot;Pe linii de business&quot;.
      </p>
      <div className="space-y-2 mb-4">
        {["Outsourcing", "Recruitment", "Coworking"].map((v, i) => (
          <div key={v} className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-gray w-4">{i + 1}.</span>
            <div className="flex-1 rounded-[10px] border border-dark-3 bg-dark px-3 py-2 text-[13px] text-gray-light">
              {v}
            </div>
          </div>
        ))}
        <button className="text-[12px] text-primary hover:text-primary-light pl-7 pt-1">
          + adauga inca una (max 5 initiale)
        </button>
      </div>
      <MockBanner tone="info">
        Verticala &quot;Toata firma&quot; se creeaza automat ca fallback pentru conturi nealocate.
      </MockBanner>
      <div className="flex justify-end gap-2 mt-5">
        <button className="text-[12px] text-gray hover:text-gray-light px-4 py-2">Renunta</button>
        <button className="text-[12px] text-white bg-primary hover:bg-primary-dark rounded-[10px] px-4 py-2 font-semibold">
          Salveaza si continua
        </button>
      </div>
    </div>
  );
}

export function MockVerticalsList() {
  const rows = [
    { name: "Outsourcing", count: "12 conturi alocate" },
    { name: "Recruitment", count: "3 conturi alocate" },
    { name: "Coworking", count: "5 conturi alocate" },
    { name: "Toata firma", count: "57 conturi · implicit", muted: true },
  ];
  return (
    <MockSurface>
      <div className="flex items-center justify-between mb-3">
        <MockLabelMono>Verticalele firmei</MockLabelMono>
        <button className="text-[11px] text-primary hover:text-primary-light">+ Adauga verticala</button>
      </div>
      <div className="space-y-1">
        {rows.map((r) => (
          <div
            key={r.name}
            className="flex items-center justify-between rounded-lg border border-dark-3 px-3 py-2"
          >
            <span className={`text-[13px] ${r.muted ? "text-gray" : "text-white"}`} style={{ letterSpacing: "-0.02em" }}>
              {r.name}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-gray">{r.count}</span>
          </div>
        ))}
      </div>
      <button className="mt-3 text-[11px] text-danger hover:text-danger/80">Dezactiveaza modulul verticalelor</button>
    </MockSurface>
  );
}

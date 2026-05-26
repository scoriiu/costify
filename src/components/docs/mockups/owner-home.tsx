/**
 * Owner Home mockups. Each section of /firma rendered as a static preview
 * with QHM21 NETWORK SRL aprilie 2026 numbers. Used inside markdown docs
 * via the `:::mockup name` fence.
 *
 * These are intentionally close to (but not the same as) the real
 * components so they degrade gracefully if the live UI changes.
 */

import {
  MockSurface,
  MockSectionTitle,
  MockBigNumber,
  MockKpiCard,
  MockBreakdownRow,
  MockBanner,
  MockLabelMono,
} from "./primitives";

export function MockPublishedBanner() {
  return (
    <MockBanner tone="info">
      <span className="text-gray-light">Date publicate:</span>{" "}
      <span className="text-white font-medium">aprilie 2026</span>{" "}
      · de Coriiu Solomon, pe 20 mai
    </MockBanner>
  );
}

export function MockKpiCards() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <MockKpiCard label="Bani in casa si banca" value="84.500 lei" tone="neutral" />
      <MockKpiCard label="De primit de la clienti" value="121.000 lei" tone="neutral" />
      <MockKpiCard label="De platit furnizorilor" value="90.069 lei" tone="neutral" />
      <MockKpiCard label="Profit anul acesta" value="+120.000 lei" tone="positive" />
    </div>
  );
}

export function MockYoyStrip() {
  return (
    <MockSurface>
      <MockSectionTitle>Comparat cu aprilie 2025</MockSectionTitle>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Vanzari", value: "+12%", tone: "positive" as const },
          { label: "Cheltuieli", value: "+8%", tone: "negative" as const },
          { label: "Profit", value: "+18%", tone: "positive" as const },
          { label: "Cash la final", value: "+5%", tone: "positive" as const },
        ].map((m) => (
          <div key={m.label} className="flex flex-col gap-1">
            <MockLabelMono>{m.label}</MockLabelMono>
            <MockBigNumber value={m.value} tone={m.tone} />
          </div>
        ))}
      </div>
    </MockSurface>
  );
}

export function MockRunwaySalary() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <MockSurface>
        <MockSectionTitle>Cati bani iti ajung</MockSectionTitle>
        <MockBigNumber value="4,2 luni" tone="neutral" />
        <p className="mt-2 text-[12px] text-gray" style={{ letterSpacing: "-0.02em" }}>
          la ritmul actual de cheltuieli, fara venituri noi
        </p>
      </MockSurface>
      <MockSurface>
        <MockSectionTitle>Cate salarii poti plati</MockSectionTitle>
        <MockBigNumber value="1,9 luni" tone="negative" />
        <p className="mt-2 text-[12px] text-gray" style={{ letterSpacing: "-0.02em" }}>
          din cash-ul de azi (nota lunara: 45.000 lei)
        </p>
      </MockSurface>
    </div>
  );
}

export function MockExpenseBreakdown() {
  const max = 45000;
  return (
    <MockSurface>
      <MockSectionTitle>Unde s-au dus banii — aprilie 2026</MockSectionTitle>
      <div className="space-y-0.5">
        <MockBreakdownRow label="Salarii si contributii" amount="45.000 lei" bar={{ value: 45000, max }} pct="53%" />
        <MockBreakdownRow label="Salarii brut" amount="35.000 lei" indent />
        <MockBreakdownRow label="Bonusuri si comisioane" amount="7.000 lei" indent />
        <MockBreakdownRow label="Contributii angajat" amount="3.000 lei" indent />
        <MockBreakdownRow label="Servicii externe" amount="23.000 lei" bar={{ value: 23000, max }} pct="27%" />
        <MockBreakdownRow label="Electricitate, apa, intretinere" amount="8.000 lei" bar={{ value: 8000, max }} pct="9%" />
        <MockBreakdownRow label="Marfa, materii prime" amount="5.000 lei" bar={{ value: 5000, max }} pct="6%" />
        <MockBreakdownRow label="Taxe si impozite" amount="4.500 lei" bar={{ value: 4500, max }} pct="5%" />
      </div>
    </MockSurface>
  );
}

export function MockRevenueBreakdown() {
  const max = 420000;
  return (
    <MockSurface>
      <MockSectionTitle>De unde au venit banii — aprilie 2026</MockSectionTitle>
      <div className="space-y-0.5">
        <MockBreakdownRow label="Vanzari (cifra de afaceri)" amount="420.000 lei" bar={{ value: 420000, max }} pct="84%" />
        <MockBreakdownRow label="Servicii de recrutare" amount="80.000 lei" bar={{ value: 80000, max }} pct="16%" />
      </div>
    </MockSurface>
  );
}

export function MockTopExpenses() {
  const rows = [
    { rank: 1, partner: "NOLICH SRL", amount: "23.451 lei", tag: "Outsourcing" },
    { rank: 2, partner: "Salarii decembrie", amount: "18.000 lei", tag: "Outsourcing 70% · Recruitment 30%" },
    { rank: 3, partner: "Chirie Eminescu 1", amount: "6.000 lei", tag: "Coworking 60% · Outsourcing 40%" },
    { rank: 4, partner: "MONT BLANC INDUSTRI", amount: "5.300 lei", tag: "Outsourcing" },
    { rank: 5, partner: "ENEL Energie", amount: "4.800 lei", tag: "Coworking 60% · Outsourcing 40%" },
  ];
  return (
    <MockSurface>
      <MockSectionTitle>Top cheltuieli ale lunii — aprilie 2026</MockSectionTitle>
      <div className="divide-y divide-dark-3">
        {rows.map((r) => (
          <div key={r.rank} className="flex items-center gap-3 py-2 text-[13px]">
            <span className="font-mono text-[11px] w-5 text-gray">{r.rank}.</span>
            <span className="flex-1 text-white" style={{ letterSpacing: "-0.02em" }}>{r.partner}</span>
            <span className="font-mono tabular-nums text-gray-light w-24 text-right">{r.amount}</span>
            <span className="hidden sm:inline font-mono text-[10px] uppercase tracking-wider text-gray w-72 text-right">{r.tag}</span>
          </div>
        ))}
      </div>
    </MockSurface>
  );
}

export function MockVerticalBreakdown() {
  const rows = [
    { name: "Outsourcing", income: "320.000 lei", expense: "250.000 lei", profit: "+70.000 lei", margin: "+22%", barPct: 100 },
    { name: "Recruitment", income: "80.000 lei", expense: "60.000 lei", profit: "+20.000 lei", margin: "+25%", barPct: 25 },
    { name: "Coworking", income: "40.000 lei", expense: "35.000 lei", profit: "+5.000 lei", margin: "+12%", barPct: 12.5 },
    { name: "Toata firma", income: "20.000 lei", expense: "18.000 lei", profit: "+2.000 lei", margin: "+10%", barPct: 6, muted: true },
  ];
  return (
    <MockSurface>
      <MockSectionTitle>Pe linii de business — aprilie 2026</MockSectionTitle>
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.name} className="rounded-lg border border-dark-3 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className={`text-[14px] font-medium ${r.muted ? "text-gray" : "text-white"}`} style={{ letterSpacing: "-0.04em" }}>
                {r.name}
              </span>
              <span className="font-mono text-[12px] text-green">{r.margin} marja</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-[12px] mb-2">
              <div>
                <div className="text-gray">venituri</div>
                <div className="font-mono tabular-nums text-gray-light">{r.income}</div>
              </div>
              <div>
                <div className="text-gray">cheltuieli</div>
                <div className="font-mono tabular-nums text-gray-light">{r.expense}</div>
              </div>
              <div>
                <div className="text-gray">profit</div>
                <div className="font-mono tabular-nums text-green">{r.profit}</div>
              </div>
            </div>
            <div className="h-1 rounded-full bg-dark-3 overflow-hidden">
              <div className={r.muted ? "h-full bg-gray/40" : "h-full bg-primary/70"} style={{ width: `${r.barPct}%` }} />
            </div>
          </div>
        ))}
      </div>
    </MockSurface>
  );
}

export function MockOwnerHomeFull() {
  return (
    <div className="space-y-4">
      <MockPublishedBanner />
      <MockKpiCards />
      <MockYoyStrip />
      <MockRunwaySalary />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <MockExpenseBreakdown />
        <MockRevenueBreakdown />
      </div>
      <MockTopExpenses />
      <MockVerticalBreakdown />
    </div>
  );
}

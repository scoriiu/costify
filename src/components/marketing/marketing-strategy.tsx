"use client";

import {
  Users,
  Building2,
  Target,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Zap,
  Shield,
  Eye,
  BarChart3,
  Upload,
  Globe,
  Smartphone,
  Clock,
  DollarSign,
  UserCheck,
  Layers,
  MessageCircle,
} from "lucide-react";

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-[20px] font-semibold text-white" style={{ letterSpacing: "-0.04em" }}>{title}</h2>
        {description && <p className="mt-1 text-[14px] text-gray">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-dark-3 bg-dark-2 p-5 ${className}`}>{children}</div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <p className="font-mono text-[28px] font-bold text-white" style={{ letterSpacing: "-0.04em" }}>{value}</p>
      <p className="mt-1 font-mono text-[11px] text-gray uppercase" style={{ letterSpacing: "-0.04em" }}>{label}</p>
    </div>
  );
}

export function MarketingStrategy() {
  return (
    <div className="mx-auto max-w-5xl space-y-16 px-8 py-10">

      {/* ─── POSITIONING ─── */}
      <div className="space-y-4">
        <p className="font-mono text-[11px] font-medium uppercase text-primary" style={{ letterSpacing: "-0.04em" }}>Positioning</p>
        <h1 className="text-[48px] font-semibold text-white leading-[102%]" style={{ letterSpacing: "-0.04em" }}>
          Doua perspective.<br />O singura platforma.
        </h1>
        <p className="max-w-2xl text-[14px] leading-[150%] text-gray-light" style={{ letterSpacing: "-0.02em" }}>
          Costify este singura platforma in care contabilul isi face treaba SI antreprenorul isi conduce business-ul, din aceleasi date.
          Nu un alt program de facturare. Nu un alt Saga. Un sistem financiar complet.
        </p>
      </div>

      {/* ─── MARKET SIZE ─── */}
      <Section title="Dimensiunea Pietei" description="Romania — cifre cheie">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card className="flex items-center justify-center py-6">
            <Stat value="1.1M" label="Companii active" />
          </Card>
          <Card className="flex items-center justify-center py-6">
            <Stat value="772K" label="Micro-intreprinderi" />
          </Card>
          <Card className="flex items-center justify-center py-6">
            <Stat value="60K" label="Cabinete contabile" />
          </Card>
          <Card className="flex items-center justify-center py-6">
            <Stat value="33K" label="Membri CECCAR" />
          </Card>
        </div>
        <Card>
          <p className="font-mono text-[11px] font-medium uppercase text-gray mb-4" style={{ letterSpacing: "-0.04em" }}>Competitia — cote de piata</p>
          <div className="space-y-3">
            {[
              { name: "SmartBill", users: "170K", type: "Facturare", color: "#3B82F6" },
              { name: "FGO.ro", users: "170K", type: "Facturare + Banca", color: "#10B981" },
              { name: "Oblio", users: "150K", type: "Facturare", color: "#F59E0B" },
              { name: "Saga", users: "Majoritate cabinete", type: "Contabilitate", color: "#EF4444" },
              { name: "Keez", users: "8.5K", type: "Contabilitate ca serviciu", color: "#8B5CF6" },
            ].map((c) => (
              <div key={c.name} className="flex items-center gap-3">
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: c.color }} />
                <span className="text-[14px] font-semibold text-white w-28" style={{ letterSpacing: "-0.04em" }}>{c.name}</span>
                <span className="font-mono text-[14px] font-medium text-gray-light w-32">{c.users}</span>
                <span className="font-mono text-[11px] text-gray">{c.type}</span>
              </div>
            ))}
          </div>
        </Card>
      </Section>

      {/* ─── THE GAP ─── */}
      <Section title="The Gap" description="Nimeni nu construieste pentru antreprenorul care vrea control financiar.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-danger/10">
                <AlertTriangle size={16} className="text-danger" />
              </div>
              <p className="text-[16px] font-semibold text-white" style={{ letterSpacing: "-0.04em" }}>Tools pt Contabili</p>
            </div>
            <ul className="space-y-2 text-[14px] text-gray-light" style={{ letterSpacing: "-0.02em" }}>
              <li>Saga, WinMentor, Ciel — desktop, ani 2000</li>
              <li>UI ostila pt oricine nu e contabil</li>
              <li>0 dashboards, 0 analytics, 0 bank feeds</li>
              <li>Antreprenorul nu vede nimic</li>
            </ul>
          </Card>
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-warn/10">
                <Zap size={16} className="text-warn" />
              </div>
              <p className="text-[16px] font-semibold text-white" style={{ letterSpacing: "-0.04em" }}>Tools pt Facturare</p>
            </div>
            <ul className="space-y-2 text-[14px] text-gray-light" style={{ letterSpacing: "-0.02em" }}>
              <li>SmartBill, Oblio, FGO — cloud, modern</li>
              <li>Tot ce fac e in jurul facturii</li>
              <li>0 budgeting, 0 forecasting, 0 cost control</li>
              <li>Contabilul primeste date, nu le produce</li>
            </ul>
          </Card>
        </div>
        <Card className="border-primary/30 bg-primary/5">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Layers size={16} className="text-primary" />
            </div>
            <div>
              <p className="text-[16px] font-semibold text-white" style={{ letterSpacing: "-0.04em" }}>costify. — Golul din piata</p>
              <p className="mt-1 text-[14px] text-gray-light" style={{ letterSpacing: "-0.02em" }}>
                Antreprenorul trimite facturi prin SmartBill, da documente contabilului pe Saga, primeste P&L dupa luni,
                gestioneaza bugete in Excel, nu stie cash-ul real, nu poate raspunde &ldquo;suntem pe buget?&rdquo; fara sa sune contabilul.
                Costify rezolva exact asta.
              </p>
            </div>
          </div>
        </Card>
      </Section>

      {/* ─── TARGET AUDIENCE ─── */}
      <Section title="Target Audience" description="Trei persoane, trei nevoi, o platforma.">
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <Users size={18} className="text-primary" />
              </div>
              <div>
                <p className="text-[16px] font-semibold text-white" style={{ letterSpacing: "-0.04em" }}>Contabilul</p>
                <p className="font-mono text-[11px] text-primary" style={{ letterSpacing: "-0.04em" }}>PRIMARY</p>
              </div>
            </div>
            <ul className="space-y-2 text-[13px] text-gray-light" style={{ letterSpacing: "-0.02em" }}>
              <li>Gestioneaza 50-2000+ companii</li>
              <li>Foloseste Saga de 20+ ani</li>
              <li>Frustrat de lipsa automatizarii</li>
              <li>Nu poate oferi clientilor vizibilitate</li>
              <li>Vrea sa-si modernizeze practica</li>
            </ul>
            <div className="mt-4 pt-3 border-t border-dark-3">
              <p className="font-mono text-[11px] text-gray uppercase" style={{ letterSpacing: "-0.04em" }}>Pain point</p>
              <p className="mt-1 text-[13px] text-white" style={{ letterSpacing: "-0.02em" }}>&ldquo;Clientii ma suna constant sa intrebe cifre pe care ar trebui sa le vada singuri.&rdquo;</p>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10">
                <Building2 size={18} className="text-accent" />
              </div>
              <div>
                <p className="text-[16px] font-semibold text-white" style={{ letterSpacing: "-0.04em" }}>Antreprenorul</p>
                <p className="font-mono text-[11px] text-accent" style={{ letterSpacing: "-0.04em" }}>SECONDARY</p>
              </div>
            </div>
            <ul className="space-y-2 text-[13px] text-gray-light" style={{ letterSpacing: "-0.02em" }}>
              <li>10-200 angajati, mai multe linii de business</li>
              <li>Bugete in Excel, cash flow necunoscut</li>
              <li>Foloseste FGO.ro + spreadsheets manual</li>
              <li>Zero vizibilitate in timp real</li>
              <li>Vrea control fara cunostinte contabile</li>
            </ul>
            <div className="mt-4 pt-3 border-t border-dark-3">
              <p className="font-mono text-[11px] text-gray uppercase" style={{ letterSpacing: "-0.04em" }}>Pain point</p>
              <p className="mt-1 text-[13px] text-white" style={{ letterSpacing: "-0.02em" }}>&ldquo;Nu stiu cat cash am azi si daca putem plati salariile luna viitoare.&rdquo;</p>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue/10">
                <BarChart3 size={18} className="text-blue" />
              </div>
              <div>
                <p className="text-[16px] font-semibold text-white" style={{ letterSpacing: "-0.04em" }}>Finance Manager</p>
                <p className="font-mono text-[11px] text-blue" style={{ letterSpacing: "-0.04em" }}>EMERGING</p>
              </div>
            </div>
            <ul className="space-y-2 text-[13px] text-gray-light" style={{ letterSpacing: "-0.02em" }}>
              <li>Angajat in firma antreprenorului</li>
              <li>Blocat intre Excel si soft contabilitate</li>
              <li>Construieste rapoarte manual</li>
              <li>Nu are drill-down sau approval workflows</li>
              <li>Vrea Budget vs Actual nativ, nu Excel</li>
            </ul>
            <div className="mt-4 pt-3 border-t border-dark-3">
              <p className="font-mono text-[11px] text-gray uppercase" style={{ letterSpacing: "-0.04em" }}>Pain point</p>
              <p className="mt-1 text-[13px] text-white" style={{ letterSpacing: "-0.02em" }}>&ldquo;Fac 3 ore pe un raport pe care il iau de la zero luna viitoare.&rdquo;</p>
            </div>
          </Card>
        </div>
      </Section>

      {/* ─── VALUE PROPOSITIONS ─── */}
      <Section title="Value Propositions" description="Ce livram fiecarei persoane.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <p className="font-mono text-[11px] font-medium uppercase text-primary mb-4" style={{ letterSpacing: "-0.04em" }}>Pt. Antreprenor</p>
            <div className="space-y-3">
              {[
                { icon: Eye, text: "Dashboard financiar real-time" },
                { icon: Target, text: "Budget vs Actual vs Forecast" },
                { icon: TrendingUp, text: "Cash flow forecasting" },
                { icon: UserCheck, text: "Cost ownership — cine e responsabil" },
                { icon: AlertTriangle, text: "Alerte proactive, nu reactive" },
                { icon: BarChart3, text: "P&L multi-vertical" },
              ].map((item) => (
                <div key={item.text} className="flex items-center gap-2.5">
                  <item.icon size={14} className="text-primary shrink-0" />
                  <span className="text-[13px] text-gray-light" style={{ letterSpacing: "-0.02em" }}>{item.text}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <p className="font-mono text-[11px] font-medium uppercase text-accent mb-4" style={{ letterSpacing: "-0.04em" }}>Pt. Contabil</p>
            <div className="space-y-3">
              {[
                { icon: Globe, text: "Cloud-native, nu port de desktop" },
                { icon: Zap, text: "Bank feeds automate (PSD2)" },
                { icon: Shield, text: "AI clasificare tranzactii" },
                { icon: Smartphone, text: "Clientii vad singuri dashboards" },
                { icon: Layers, text: "1000+ companii dintr-o platforma" },
                { icon: DollarSign, text: "Revenue share program referral" },
              ].map((item) => (
                <div key={item.text} className="flex items-center gap-2.5">
                  <item.icon size={14} className="text-accent shrink-0" />
                  <span className="text-[13px] text-gray-light" style={{ letterSpacing: "-0.02em" }}>{item.text}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </Section>

      {/* ─── COMPETITIVE ADVANTAGES ─── */}
      <Section title="vs. Competitia" description="Avantaje concrete per competitor.">
        <Card className="overflow-hidden p-0">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-dark-3 bg-dark-3/30">
                <th className="px-4 py-3 text-left font-mono text-[11px] font-medium uppercase text-gray" style={{ letterSpacing: "-0.04em" }}>vs.</th>
                <th className="px-4 py-3 text-left font-mono text-[11px] font-medium uppercase text-gray" style={{ letterSpacing: "-0.04em" }}>Ce le lipseste</th>
                <th className="px-4 py-3 text-left font-mono text-[11px] font-medium uppercase text-gray" style={{ letterSpacing: "-0.04em" }}>Costify livreaza</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-3/50">
              {[
                { vs: "Saga", lacks: "Cloud nativ, dashboards, bank feeds, API, management layer", delivers: "Totul in browser, dual UX, automatizare, audit trail" },
                { vs: "SmartBill", lacks: "Motor contabil complet, budgets, bank feeds, treasury", delivers: "Full financial OS, nu doar facturare" },
                { vs: "Oblio", lacks: "Motor contabil, management, analytics, payroll", delivers: "Contabilitate + management din acelasi sistem" },
                { vs: "Keez", lacks: "Self-serve (e serviciu obligatoriu), bugete, forecasts", delivers: "Platforma software, orice contabil, pret/luna nu pret/ora" },
                { vs: "FGO", lacks: "Motor contabil, dashboards, analytics, intelligence", delivers: "Bank data folosit pt intelligence, nu doar matching" },
                { vs: "Finlight", lacks: "Multi-tenant pt contabili, adapter per soft, AI, pret per-portofoliu, simplitate", delivers: "Contabilul gestioneaza 1000+ clienti, import automat Saga/SmartBill/Ciel, Costi AI, UX simplu pentru antreprenor" },
              ].map((row) => (
                <tr key={row.vs} className="hover:bg-dark-3/20 transition-colors">
                  <td className="px-4 py-3 font-semibold text-white" style={{ letterSpacing: "-0.04em" }}>{row.vs}</td>
                  <td className="px-4 py-3 text-gray-light" style={{ letterSpacing: "-0.02em" }}>{row.lacks}</td>
                  <td className="px-4 py-3 text-accent" style={{ letterSpacing: "-0.02em" }}>{row.delivers}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </Section>

      {/* ─── SIMPLICITY ─── */}
      <Section title="Simplitate ca avantaj competitiv" description="Finlight e chineza pentru antreprenori. Costify nu va fi.">
        <Card>
          <p className="font-mono text-[11px] font-medium uppercase text-danger mb-4" style={{ letterSpacing: "-0.04em" }}>Problema reala</p>
          <p className="text-[14px] leading-relaxed text-gray-light" style={{ letterSpacing: "-0.02em" }}>
            Un antreprenor care a testat Finlight a spus: &ldquo;e chineza&rdquo;. Zeci de indicatori financiari,
            Index Financiar, solvabilitate, lichiditate, rezultat operational — vocabular care suna profesionist
            dar pe care un om care conduce o firma cu 5 angajati nu il recunoaste. Finlight a facut o versiune
            mai frumoasa a aceluiasi jargon. Jargonul nu a disparut — doar a primit fonturi mai mari.
          </p>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="border-danger/20">
            <p className="font-mono text-[11px] font-medium uppercase text-danger mb-4" style={{ letterSpacing: "-0.04em" }}>Finlight — complexitate vizibila</p>
            <ul className="space-y-2 text-[13px] text-gray-light" style={{ letterSpacing: "-0.02em" }}>
              <li>Mapare manuala de coloane la fiecare import</li>
              <li>Buton &ldquo;Calculeaza indicatori&rdquo; apasat manual</li>
              <li>3 etape pentru un singur import (upload → map → confirm → calculate)</li>
              <li>Vocabular OMFP pe interfata antreprenorului</li>
              <li>Zeci de indicatori afisati simultan, fara prioritizare</li>
              <li>Pret per firma — contabilul cu 50 clienti plateste x50</li>
            </ul>
          </Card>
          <Card className="border-primary/20">
            <p className="font-mono text-[11px] font-medium uppercase text-primary mb-4" style={{ letterSpacing: "-0.04em" }}>Costify — simplitate ca principiu</p>
            <ul className="space-y-2 text-[13px] text-gray-light" style={{ letterSpacing: "-0.02em" }}>
              <li>Adapter per soft contabil — incarci fisierul, merge direct</li>
              <li>Calcul instant din jurnal, fara buton &ldquo;recalculeaza&rdquo;</li>
              <li>Import in 2 pasi: upload → vezi rezultatul</li>
              <li>Doua limbi: contabilul vede OMFP, antreprenorul vede &ldquo;cat am in banca&rdquo;</li>
              <li>KPI-uri cu sens, nu zeci de indicatori — doar ce conteaza acum</li>
              <li>Pret per portofoliu — contabilul plateste o data pentru toti clientii</li>
            </ul>
          </Card>
        </div>

        <Card className="border-primary/30 bg-primary/5">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Eye size={16} className="text-primary" />
            </div>
            <div>
              <p className="text-[16px] font-semibold text-white" style={{ letterSpacing: "-0.04em" }}>Regula de design</p>
              <p className="mt-2 text-[14px] text-gray-light leading-relaxed" style={{ letterSpacing: "-0.02em" }}>
                Daca un ecran necesita explicatie, ecranul e gresit. Daca un flux are mai mult de 3 pasi, fluxul e gresit.
                Daca un label foloseste un cuvant pe care utilizatorul trebuie sa-l caute pe Google, label-ul e gresit.
                Costify trebuie sa fie folosibil de un antreprenor care n-a deschis niciodata o aplicatie de contabilitate.
                Barul nostru: un contabil cu 100 clienti adauga un client nou in sub 60 secunde, iar un antreprenor
                vede cum sta firma lui fara documentatie.
              </p>
            </div>
          </div>
        </Card>
      </Section>

      {/* ─── GTM STRATEGY ─── */}
      <Section title="Go-To-Market" description="Trei faze, de la wedge la piata.">
        <div className="space-y-4">
          <Card>
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-mono text-[16px] font-bold text-primary">1</div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-[16px] font-semibold text-white" style={{ letterSpacing: "-0.04em" }}>The Wedge</p>
                  <span className="font-mono text-[11px] text-gray">Lunile 3-5</span>
                </div>
                <p className="mt-1 text-[14px] text-gray-light" style={{ letterSpacing: "-0.02em" }}>
                  Target: Antreprenori care gestioneaza bugete in Excel (10-50 angajati, mai multe business lines).
                </p>
                <p className="mt-2 text-[14px] font-semibold text-white" style={{ letterSpacing: "-0.04em" }}>
                  &ldquo;Vezi unde se duc banii. In timp real. Fara Excel.&rdquo;
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {["Outreach direct", "LinkedIn content", "3-5 cabinete partenere"].map((ch) => (
                    <span key={ch} className="rounded-md border border-dark-3 px-2.5 py-1 font-mono text-[11px] text-gray">{ch}</span>
                  ))}
                </div>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 font-mono text-[16px] font-bold text-accent">2</div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-[16px] font-semibold text-white" style={{ letterSpacing: "-0.04em" }}>The Accountant</p>
                  <span className="font-mono text-[11px] text-gray">Lunile 6-12</span>
                </div>
                <p className="mt-1 text-[14px] text-gray-light" style={{ letterSpacing: "-0.02em" }}>
                  Target: Cabinete contabile cu 50-500 companii, mai ales userii Saga frustrati.
                </p>
                <p className="mt-2 text-[14px] font-semibold text-white" style={{ letterSpacing: "-0.04em" }}>
                  &ldquo;Tot ce face Saga, plus clientii tai pot in sfarsit sa-si vada cifrele.&rdquo;
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {["Parteneriate CECCAR", "Migrare gratuita din Saga", "Content marketing", "Referral cu revenue share"].map((ch) => (
                    <span key={ch} className="rounded-md border border-dark-3 px-2.5 py-1 font-mono text-[11px] text-gray">{ch}</span>
                  ))}
                </div>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue/10 font-mono text-[16px] font-bold text-blue">3</div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-[16px] font-semibold text-white" style={{ letterSpacing: "-0.04em" }}>The Market</p>
                  <span className="font-mono text-[11px] text-gray">Luna 13+</span>
                </div>
                <p className="mt-1 text-[14px] text-gray-light" style={{ letterSpacing: "-0.02em" }}>
                  Target: Mass market — fiecare SRL si PFA din Romania.
                </p>
                <p className="mt-2 text-[14px] font-semibold text-white" style={{ letterSpacing: "-0.04em" }}>
                  &ldquo;Sistemul financiar al business-ului tau.&rdquo;
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {["SEO (program contabilitate)", "Parteneriate firme noi", "Free tier", "Parteneriate ANAF", "Expansiune EU"].map((ch) => (
                    <span key={ch} className="rounded-md border border-dark-3 px-2.5 py-1 font-mono text-[11px] text-gray">{ch}</span>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </div>
      </Section>

      {/* ─── PRICING ─── */}
      <Section title="Pricing Strategy" description="Context: contabilitatea costa 300-6000 RON/luna. Costify e o fractiune.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { name: "Starter", price: "15", period: "/luna", target: "PFA / Micro-SRL", features: ["1 companie", "Dashboard + KPI", "Import jurnal", "Rapoarte de baza"] },
            { name: "Business", price: "39", period: "/luna", target: "SRL cu 5-50 angajati", features: ["3 companii", "Bank feeds", "Budget vs Actual", "Export PDF/Excel"] },
            { name: "Enterprise", price: "99", period: "/luna", target: "Grupuri + multi-vertical", features: ["Companii nelimitate", "Multi-vertical P&L", "Forecasting", "API access"] },
            { name: "Accountant", price: "149-399", period: "/luna", target: "Cabinete contabile", features: ["50-500+ companii", "Client portal", "White-label optional", "Revenue share"] },
          ].map((tier) => (
            <Card key={tier.name}>
              <p className="text-[16px] font-semibold text-white" style={{ letterSpacing: "-0.04em" }}>{tier.name}</p>
              <p className="mt-1 font-mono text-[11px] text-gray">{tier.target}</p>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="font-mono text-[28px] font-bold text-white" style={{ letterSpacing: "-0.04em" }}>{tier.price}</span>
                <span className="font-mono text-[11px] text-gray">EUR{tier.period}</span>
              </div>
              <ul className="mt-4 space-y-2">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-[13px] text-gray-light" style={{ letterSpacing: "-0.02em" }}>
                    <CheckCircle2 size={12} className="text-accent shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </Section>

      {/* ─── YEAR 1 TARGETS ─── */}
      <Section title="Year 1 Targets" description="Obiective conservative dar masurabile.">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card className="flex items-center justify-center py-6">
            <Stat value="500" label="Companii active" />
          </Card>
          <Card className="flex items-center justify-center py-6">
            <Stat value="50" label="Cabinete contabile" />
          </Card>
          <Card className="flex items-center justify-center py-6">
            <Stat value="25K" label="EUR MRR" />
          </Card>
          <Card className="flex items-center justify-center py-6">
            <Stat value="&lt;5%" label="Monthly churn" />
          </Card>
        </div>
      </Section>

      {/* ─── MESSAGING ─── */}
      <Section title="Core Messaging" description="Cum vorbim cu fiecare audienta.">
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <p className="font-mono text-[11px] font-medium uppercase text-primary mb-3" style={{ letterSpacing: "-0.04em" }}>Antreprenor</p>
            <p className="text-[16px] font-semibold text-white leading-tight" style={{ letterSpacing: "-0.04em" }}>
              &ldquo;In sfarsit vezi unde se duc banii. In timp real. Fara Excel.&rdquo;
            </p>
          </Card>
          <Card>
            <p className="font-mono text-[11px] font-medium uppercase text-accent mb-3" style={{ letterSpacing: "-0.04em" }}>Contabil</p>
            <p className="text-[16px] font-semibold text-white leading-tight" style={{ letterSpacing: "-0.04em" }}>
              &ldquo;Modernizeaza-ti practica fara sa pierzi ce functioneaza.&rdquo;
            </p>
          </Card>
          <Card>
            <p className="font-mono text-[11px] font-medium uppercase text-blue mb-3" style={{ letterSpacing: "-0.04em" }}>Finance Manager</p>
            <p className="text-[16px] font-semibold text-white leading-tight" style={{ letterSpacing: "-0.04em" }}>
              &ldquo;Budget vs Actual nativ. Nu mai reconstrui raportul luna viitoare.&rdquo;
            </p>
          </Card>
        </div>
      </Section>

      {/* ─── KEY INSIGHT ─── */}
      <Card className="border-primary/30 bg-primary/5">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <MessageCircle size={16} className="text-primary" />
          </div>
          <div>
            <p className="text-[16px] font-semibold text-white" style={{ letterSpacing: "-0.04em" }}>Strategic Insight</p>
            <p className="mt-2 text-[14px] text-gray-light leading-relaxed" style={{ letterSpacing: "-0.02em" }}>
              Saga Web la 95% paritate cu desktopul e competitorul real. Dar ei porteaza, nu regandesc.
              Visma detine SmartBill + Keez dar nu le-a integrat in 18+ ani. Fereastra de oportunitate e acum,
              cat competitia migreaza arhitectural. FGO are conexiuni PSD2 la ING, BCR, Erste, Revolut, Wise —
              dovada ca cererea de bank feeds exista. Compliance-ul e-Factura/SAF-T e table stakes dar si moat:
              390+ elemente obligatorii creeaza switching costs reale.
            </p>
          </div>
        </div>
      </Card>

    </div>
  );
}

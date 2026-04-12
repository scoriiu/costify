"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/ui/logo";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer,
  AreaChart, Area, LineChart, Line, PieChart, Pie, Cell, Legend,
  RadialBarChart, RadialBar,
} from "recharts";
import { CostiMascot, type CostiState } from "@/components/costi/costi-mascot";
import {
  Users,
  FileBarChart,
  Settings,
  MessageCircle,
  Upload,
  Download,
  Search,
  Plus,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Building2,
} from "lucide-react";

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white">{title}</h2>
        {description && <p className="mt-1 text-sm text-gray">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function Swatch({ name, value, textClass }: { name: string; value: string; textClass?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-12 w-12 rounded-lg border border-dark-3 shadow-sm" style={{ backgroundColor: value }} />
      <div>
        <p className={`text-sm font-semibold ${textClass || "text-white"}`}>{name}</p>
        <p className="text-xs text-gray font-mono">{value}</p>
      </div>
    </div>
  );
}

function SwatchRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray">{label}</h3>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{children}</div>
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-dark-3 bg-dark-2 p-5 ${className}`}>{children}</div>
  );
}

function KpiCard({ label, value, change, positive }: { label: string; value: string; change: string; positive: boolean }) {
  return (
    <Card>
      <p className="text-xs font-medium uppercase tracking-wider text-gray">{label}</p>
      <p className="mt-1.5 text-2xl font-bold text-white">{value}</p>
      <div className={`mt-2 flex items-center gap-1 text-xs font-medium ${positive ? "text-green" : "text-danger"}`}>
        {positive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
        {change}
      </div>
    </Card>
  );
}

const TEXT_ON_DARK = "#E9E8E3";

const PALETTES = [
  {
    name: "Evergreen Teal",
    desc: "Money-coded, unique in RO market, premium on warm cream, institutional trust",
    primary: "#0D6B5E", primaryDark: "#0A5A4F", primaryLight: "#34D3A0",
    accent: "#3FB950", warn: "#F59E0B", danger: "#EF4444",
    textOnPrimary: TEXT_ON_DARK,
  },
];

function PaletteExplorer() {
  return (
    <div className="space-y-10">
      {PALETTES.map((p) => (
        <div key={p.name} className="rounded-xl border border-dark-3 overflow-hidden">
          {/* Banner */}
          <div className="relative h-28 flex items-end p-5" style={{ background: `linear-gradient(135deg, ${p.primaryDark} 0%, ${p.primary} 50%, ${p.primaryLight} 100%)` }}>
            <div>
              <h3 className="text-lg font-bold drop-shadow-sm" style={{ color: p.textOnPrimary }}>{p.name}</h3>
              <p className="text-xs" style={{ color: `${p.textOnPrimary}B0` }}>{p.desc}</p>
            </div>
          </div>

          {/* Palette swatches */}
          <div className="flex border-b border-dark-3">
            {[
              { label: "Primary Dark", color: p.primaryDark },
              { label: "Primary", color: p.primary },
              { label: "Primary Light", color: p.primaryLight },
              { label: "Accent", color: p.accent },
              { label: "Warning", color: p.warn },
              { label: "Danger", color: p.danger },
            ].map((s) => (
              <div key={s.label} className="flex-1 flex flex-col items-center py-3 gap-1.5">
                <div className="h-8 w-8 rounded-full border border-dark-3" style={{ backgroundColor: s.color }} />
                <span className="text-[0.55rem] text-gray">{s.label}</span>
                <span className="text-[0.5rem] font-mono text-gray/60">{s.color}</span>
              </div>
            ))}
          </div>

          {/* Dark theme preview */}
          <div className="bg-dark-2 p-5 space-y-4">
            <p className="text-[0.6rem] font-semibold uppercase tracking-wider text-gray">Dark Theme</p>

            {/* Buttons + badge */}
            <div className="flex flex-wrap items-center gap-3">
              <button className="inline-flex items-center gap-2 rounded-[10px] px-5 py-2.5 text-sm font-semibold" style={{ backgroundColor: p.primary, boxShadow: `0 4px 20px ${p.primary}40`, color: p.textOnPrimary }}>
                <Upload size={15} /> Importa Date
              </button>
              <button className="inline-flex items-center gap-2 rounded-[10px] border px-5 py-2.5 text-sm font-semibold" style={{ borderColor: `${p.primary}40`, color: p.primaryLight }}>
                Exporta PDF
              </button>
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold" style={{ backgroundColor: `${p.accent}15`, color: p.accent }}>
                <CheckCircle2 size={13} /> Activ
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold" style={{ backgroundColor: `${p.warn}15`, color: p.warn }}>
                <AlertTriangle size={13} /> Atentie
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold" style={{ backgroundColor: `${p.danger}15`, color: p.danger }}>
                <XCircle size={13} /> Eroare
              </span>
            </div>

            {/* KPI row */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "Disponibil", val: "234.567", ch: "+12,3%", pos: true },
                { label: "Creante", val: "89.012", ch: "-5,1%", pos: false },
                { label: "Datorii", val: "156.789", ch: "+2,8%", pos: false },
                { label: "Profit Net", val: "45.678", ch: "+18,7%", pos: true },
              ].map((k) => (
                <div key={k.label} className="rounded-lg border border-dark-3 bg-dark p-3">
                  <p className="text-[0.6rem] uppercase tracking-wider text-gray">{k.label}</p>
                  <p className="mt-1 text-lg font-bold text-white font-mono">{k.val}</p>
                  <div className={`mt-1 flex items-center gap-1 text-[0.65rem] font-medium ${k.pos ? "text-green" : "text-danger"}`}>
                    {k.pos ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />} {k.ch}
                  </div>
                </div>
              ))}
            </div>

            {/* Table */}
            <div className="rounded-lg border border-dark-3 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-dark-3 bg-dark-3/30">
                    <th className="px-3 py-2 text-left text-[0.6rem] font-semibold uppercase tracking-wider text-gray">Cont</th>
                    <th className="px-3 py-2 text-left text-[0.6rem] font-semibold uppercase tracking-wider text-gray">Denumire</th>
                    <th className="px-3 py-2 text-right text-[0.6rem] font-semibold uppercase tracking-wider text-gray">Sold Final</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-dark-3/50">
                    <td className="px-3 py-1.5 font-mono text-xs font-semibold" style={{ color: p.primaryLight }}>5121</td>
                    <td className="px-3 py-1.5 text-xs text-gray-light">Conturi la banci in lei</td>
                    <td className="px-3 py-1.5 text-right font-mono text-xs text-green">246.913,57</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-1.5 font-mono text-xs font-semibold" style={{ color: p.primaryLight }}>401</td>
                    <td className="px-3 py-1.5 text-xs text-gray-light">Furnizori</td>
                    <td className="px-3 py-1.5 text-right font-mono text-xs text-danger">111.110,11</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Sidebar nav preview */}
            <div className="flex items-center gap-1">
              <div className="flex items-center gap-2 border-l-2 rounded-r-md px-3 py-1.5 text-xs font-semibold text-white" style={{ borderColor: p.primary, backgroundColor: `${p.primary}10` }}>
                <Users size={14} style={{ color: p.primaryLight }} /> Clienti
              </div>
              <div className="flex items-center gap-2 border-l-2 border-transparent px-3 py-1.5 text-xs text-gray">
                <FileBarChart size={14} /> Rapoarte
              </div>
              <div className="flex items-center gap-2 border-l-2 border-transparent px-3 py-1.5 text-xs text-gray">
                <Settings size={14} /> Setari
              </div>
            </div>
          </div>

          {/* Light theme preview */}
          <div className="p-5 space-y-4" style={{ backgroundColor: "#F0EFEA" }}>
            <p className="text-[0.6rem] font-semibold uppercase tracking-wider" style={{ color: "#7A766E" }}>Light Theme</p>

            <div className="flex flex-wrap items-center gap-3">
              <button className="inline-flex items-center gap-2 rounded-[10px] px-5 py-2.5 text-sm font-semibold" style={{ backgroundColor: p.primary, boxShadow: `0 4px 16px ${p.primary}25`, color: p.textOnPrimary }}>
                <Upload size={15} /> Importa Date
              </button>
              <button className="inline-flex items-center gap-2 rounded-[10px] border px-5 py-2.5 text-sm font-semibold" style={{ borderColor: `${p.primary}30`, color: p.primary }}>
                Exporta PDF
              </button>
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold" style={{ backgroundColor: `${p.accent}12`, color: "#059669" }}>
                <CheckCircle2 size={13} /> Activ
              </span>
            </div>

            {/* Light KPI row */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "Disponibil", val: "234.567", ch: "+12,3%", pos: true },
                { label: "Creante", val: "89.012", ch: "-5,1%", pos: false },
                { label: "Datorii", val: "156.789", ch: "+2,8%", pos: false },
                { label: "Profit Net", val: "45.678", ch: "+18,7%", pos: true },
              ].map((k) => (
                <div key={k.label} className="rounded-lg p-3" style={{ backgroundColor: "#F7F6F2", border: "1px solid #E6E4DE" }}>
                  <p className="text-[0.6rem] uppercase tracking-wider" style={{ color: "#7A766E" }}>{k.label}</p>
                  <p className="mt-1 text-lg font-bold font-mono" style={{ color: "#1A1918" }}>{k.val}</p>
                  <div className={`mt-1 flex items-center gap-1 text-[0.65rem] font-medium`} style={{ color: k.pos ? "#059669" : "#DC2626" }}>
                    {k.pos ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />} {k.ch}
                  </div>
                </div>
              ))}
            </div>

            {/* Light table */}
            <div className="rounded-lg overflow-hidden" style={{ border: "1px solid #E6E4DE" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: "#E6E4DE", borderBottom: "1px solid #D9D7D0" }}>
                    <th className="px-3 py-2 text-left text-[0.6rem] font-semibold uppercase tracking-wider" style={{ color: "#7A766E" }}>Cont</th>
                    <th className="px-3 py-2 text-left text-[0.6rem] font-semibold uppercase tracking-wider" style={{ color: "#7A766E" }}>Denumire</th>
                    <th className="px-3 py-2 text-right text-[0.6rem] font-semibold uppercase tracking-wider" style={{ color: "#7A766E" }}>Sold Final</th>
                  </tr>
                </thead>
                <tbody style={{ backgroundColor: "#F7F6F2" }}>
                  <tr style={{ borderBottom: "1px solid #E6E4DE" }}>
                    <td className="px-3 py-1.5 font-mono text-xs font-semibold" style={{ color: p.primary }}>5121</td>
                    <td className="px-3 py-1.5 text-xs" style={{ color: "#44413C" }}>Conturi la banci in lei</td>
                    <td className="px-3 py-1.5 text-right font-mono text-xs font-semibold" style={{ color: "#059669" }}>246.913,57</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-1.5 font-mono text-xs font-semibold" style={{ color: p.primary }}>401</td>
                    <td className="px-3 py-1.5 text-xs" style={{ color: "#44413C" }}>Furnizori</td>
                    <td className="px-3 py-1.5 text-right font-mono text-xs font-semibold" style={{ color: "#DC2626" }}>111.110,11</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Light nav */}
            <div className="flex items-center gap-1">
              <div className="flex items-center gap-2 border-l-2 rounded-r-md px-3 py-1.5 text-xs font-semibold" style={{ borderColor: p.primary, backgroundColor: `${p.primary}08`, color: "#1A1918" }}>
                <Users size={14} style={{ color: p.primary }} /> Clienti
              </div>
              <div className="flex items-center gap-2 border-l-2 border-transparent px-3 py-1.5 text-xs" style={{ color: "#7A766E" }}>
                <FileBarChart size={14} /> Rapoarte
              </div>
              <div className="flex items-center gap-2 border-l-2 border-transparent px-3 py-1.5 text-xs" style={{ color: "#7A766E" }}>
                <Settings size={14} /> Setari
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function DesignSystem() {
  const costiStates: CostiState[] = ["greeting", "thinking", "success", "alert", "error", "working", "celebrating", "sleeping", "teaching"];

  return (
    <div className="mx-auto max-w-5xl space-y-16 px-8 py-10">

      {/* ─── INTRO ─── */}
      <div className="space-y-3">
        <h1 className="text-[28px] font-semibold text-white" style={{ letterSpacing: "-0.04em" }}>Design System</h1>
        <p className="max-w-2xl text-[14px] leading-[150%] text-gray" style={{ letterSpacing: "-0.02em" }}>
          Limbajul vizual al costify. — profesionalism, claritate, densitate de date,
          cu un strop de personalitate prin mascota Costi.
        </p>
      </div>

      {/* ─── COLOR EXPLORATION ─── */}
      <Section title="Evergreen Teal — Paleta principala" description="Vizualizare completa: banner gradient, swatches, butoane, badge-uri, KPI cards, tabele si navigare pe ambele teme.">
        <PaletteExplorer />
      </Section>

      {/* ─── DESIGN PRINCIPLES ─── */}
      <Section title="Design Principles">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <CheckCircle2 size={18} className="text-primary" />
            </div>
            <h3 className="text-sm font-bold text-white">Simplicity is the product</h3>
            <p className="mt-1 text-xs leading-relaxed text-gray">
              If a screen needs explanation, the screen is wrong. If a flow has more than three steps,
              the flow is wrong. Usable by an entrepreneur who never opened an accounting app.
            </p>
          </Card>
          <Card>
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <TrendingUp size={18} className="text-primary-light" />
            </div>
            <h3 className="text-sm font-bold text-white">Conservative color</h3>
            <p className="mt-1 text-xs leading-relaxed text-gray">
              Reserve strong color for meaning: green = positive, red = attention, teal = primary actions.
              Let data breathe on neutral surfaces. Never use a rainbow of colors.
            </p>
          </Card>
          <Card>
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <MessageCircle size={18} className="text-primary-light" />
            </div>
            <h3 className="text-sm font-bold text-white">Friendly, not childish</h3>
            <p className="mt-1 text-xs leading-relaxed text-gray">
              Costi the mascot adds warmth and personality. Rounded corners, gentle shadows,
              and micro-interactions make the experience feel human without undermining trust.
            </p>
          </Card>
          <Card>
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Search size={18} className="text-primary-light" />
            </div>
            <h3 className="text-sm font-bold text-white">Progressive disclosure</h3>
            <p className="mt-1 text-xs leading-relaxed text-gray">
              Show summary KPIs first. Let users drill into details. Accountants juggle 1000+ clients.
              Surface what matters, hide complexity until needed.
            </p>
          </Card>
          <Card>
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <FileBarChart size={18} className="text-primary-light" />
            </div>
            <h3 className="text-sm font-bold text-white">Data density done right</h3>
            <p className="mt-1 text-xs leading-relaxed text-gray">
              Accountants want to see more, not less. Compact tables, tight spacing in data views,
              generous whitespace in navigation and actions.
            </p>
          </Card>
          <Card>
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Settings size={18} className="text-primary-light" />
            </div>
            <h3 className="text-sm font-bold text-white">Consistent patterns</h3>
            <p className="mt-1 text-xs leading-relaxed text-gray">
              Same border radius, same shadow depth, same spacing scale everywhere.
              Predictability builds muscle memory. Accountants work fast — don't slow them down.
            </p>
          </Card>
        </div>
      </Section>

      {/* ─── COLOR PALETTE ─── */}
      <Section title="Color Palette" description="Paleta restrictiva: Evergreen Teal ca brand, culori semantice cu sens, suprafete teal-tinted pe dark, cream pe light.">
        <SwatchRow label="Brand — Evergreen Teal">
          <Swatch name="Primary" value="#0D6B5E" />
          <Swatch name="Primary Dark" value="#0A5A4F" />
          <Swatch name="Primary Light" value="#34D3A0" />
        </SwatchRow>
        <SwatchRow label="Semantic">
          <Swatch name="Danger" value="#EF4444" />
          <Swatch name="Warning" value="#F59E0B" />
          <Swatch name="Green" value="#3FB950" />
        </SwatchRow>
        <SwatchRow label="Surfaces — Dark Theme (teal-tinted)">
          <Swatch name="Surface 0 (BG)" value="#0B1514" />
          <Swatch name="Surface 1 (Card)" value="#111F1E" />
          <Swatch name="Surface 2 (Border)" value="#182A28" />
          <Swatch name="Surface 3 (Subtle)" value="#223633" />
        </SwatchRow>
        <SwatchRow label="Surfaces — Light Theme (warm cream)">
          <Swatch name="Surface 0 (BG)" value="#F0EFEA" />
          <Swatch name="Surface 1 (Card)" value="#F7F6F2" />
          <Swatch name="Surface 2 (Border)" value="#E6E4DE" />
          <Swatch name="Surface 3 (Subtle)" value="#D9D7D0" />
        </SwatchRow>
        <SwatchRow label="Text — Dark Theme">
          <Swatch name="Primary" value="#E9E8E3" />
          <Swatch name="Secondary" value="#C5C3BC" />
          <Swatch name="Muted" value="#8A877F" />
        </SwatchRow>
        <SwatchRow label="Text — Light Theme">
          <Swatch name="Primary" value="#1A1918" />
          <Swatch name="Secondary" value="#44413C" />
          <Swatch name="Muted" value="#7A766E" />
        </SwatchRow>
      </Section>

      {/* ─── TYPOGRAPHY ─── */}
      <Section title="Typography" description="Altform for all UI text. Geist Mono for financial numbers. Tight tracking (-0.04em) on headings, slightly looser (-0.02em) on body. Inspired by Danubian's type system, scaled for dashboard density.">

        {/* Reference table */}
        <Card className="overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dark-3 bg-dark-3/30">
                <th className="px-4 py-2.5 text-left text-[0.6rem] font-semibold uppercase tracking-wider text-gray">Role</th>
                <th className="px-4 py-2.5 text-left text-[0.6rem] font-semibold uppercase tracking-wider text-gray">Font</th>
                <th className="px-4 py-2.5 text-left text-[0.6rem] font-semibold uppercase tracking-wider text-gray">Size</th>
                <th className="px-4 py-2.5 text-left text-[0.6rem] font-semibold uppercase tracking-wider text-gray">Weight</th>
                <th className="px-4 py-2.5 text-left text-[0.6rem] font-semibold uppercase tracking-wider text-gray">Line-height</th>
                <th className="px-4 py-2.5 text-left text-[0.6rem] font-semibold uppercase tracking-wider text-gray">Tracking</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-3/50 font-mono text-xs">
              {[
                { role: "Hero / Landing", font: "Altform", size: "48px", weight: "600", lh: "102%", tr: "-0.04em" },
                { role: "Page Title", font: "Altform", size: "28px", weight: "600", lh: "99%", tr: "-0.04em" },
                { role: "Section Title", font: "Altform", size: "20px", weight: "600", lh: "99%", tr: "-0.04em" },
                { role: "Card Title", font: "Altform", size: "16px", weight: "600", lh: "99%", tr: "-0.04em" },
                { role: "Body", font: "Altform", size: "14px", weight: "400", lh: "150%", tr: "-0.02em" },
                { role: "Small Body", font: "Altform", size: "13px", weight: "400", lh: "140%", tr: "-0.02em" },
                { role: "Link", font: "Altform", size: "14px", weight: "600", lh: "99%", tr: "-0.04em" },
                { role: "Label", font: "Geist Mono", size: "11px", weight: "500", lh: "99%", tr: "-0.04em" },
                { role: "Data Label", font: "Geist Mono", size: "14px", weight: "400", lh: "99%", tr: "-0.04em" },
                { role: "Data Value", font: "Geist Mono", size: "14px", weight: "500", lh: "99%", tr: "-0.04em" },
                { role: "KPI Number", font: "Geist Mono", size: "24px", weight: "700", lh: "100%", tr: "-0.02em" },
                { role: "Table Number", font: "Geist Mono", size: "13px", weight: "400", lh: "99%", tr: "-0.02em" },
              ].map((row) => (
                <tr key={row.role} className="hover:bg-dark-3/20 transition-colors">
                  <td className="px-4 py-2 text-white font-sans font-semibold text-sm" style={{ letterSpacing: "-0.04em" }}>{row.role}</td>
                  <td className="px-4 py-2 text-gray-light">{row.font}</td>
                  <td className="px-4 py-2 text-primary-light">{row.size}</td>
                  <td className="px-4 py-2 text-gray-light">{row.weight}</td>
                  <td className="px-4 py-2 text-gray-light">{row.lh}</td>
                  <td className="px-4 py-2 text-gray-light">{row.tr}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {/* Live samples */}
        <Card>
          <div className="space-y-8">
            <div>
              <p className="font-mono text-[0.65rem] text-gray mb-2">Hero — Altform 48px / 600 / -0.04em</p>
              <p className="text-[48px] font-semibold text-white leading-[102%]" style={{ letterSpacing: "-0.04em" }}>Control Financiar</p>
            </div>
            <div>
              <p className="font-mono text-[0.65rem] text-gray mb-2">Page Title — Altform 28px / 600 / -0.04em</p>
              <p className="text-[28px] font-semibold text-white leading-[99%]" style={{ letterSpacing: "-0.04em" }}>Bilant la 31.12.2024</p>
            </div>
            <div>
              <p className="font-mono text-[0.65rem] text-gray mb-2">Section Title — Altform 20px / 600 / -0.04em</p>
              <p className="text-[20px] font-semibold text-white leading-[99%]" style={{ letterSpacing: "-0.04em" }}>Active Curente</p>
            </div>
            <div>
              <p className="font-mono text-[0.65rem] text-gray mb-2">Card Title — Altform 16px / 600 / -0.04em</p>
              <p className="text-[16px] font-semibold text-white leading-[99%]" style={{ letterSpacing: "-0.04em" }}>Lichiditate Curenta</p>
            </div>
            <div>
              <p className="font-mono text-[0.65rem] text-gray mb-2">Body — Altform 14px / 400 / -0.02em</p>
              <p className="text-[14px] text-gray-light leading-[150%]" style={{ letterSpacing: "-0.02em" }}>Raportul financiar arata o crestere de 12% fata de anul precedent, sustinuta de veniturile operationale si reducerea cheltuielilor administrative.</p>
            </div>
            <div>
              <p className="font-mono text-[0.65rem] text-gray mb-2">Link — Altform 14px / 600 / -0.04em / underline</p>
              <p className="text-[14px] font-semibold text-primary-light leading-[99%] underline" style={{ letterSpacing: "-0.04em" }}>Vezi detalii</p>
            </div>

            <div className="border-t border-dark-3 pt-6">
              <p className="font-mono text-[0.65rem] text-gray mb-4">Monospace — Geist Mono (labels, data, numbers)</p>
              <div className="space-y-4">
                <div className="flex items-baseline justify-between max-w-sm">
                  <p className="font-mono text-[11px] font-medium uppercase text-gray" style={{ letterSpacing: "-0.04em" }}>Total Datorii</p>
                  <p className="font-mono text-[0.65rem] text-gray/50">Label 11px / 500 / uppercase</p>
                </div>
                <div className="flex items-baseline justify-between max-w-sm">
                  <p className="font-mono text-[14px] text-gray" style={{ letterSpacing: "-0.04em" }}>sold final</p>
                  <p className="font-mono text-[0.65rem] text-gray/50">Data Label 14px / 400</p>
                </div>
                <div className="flex items-baseline justify-between max-w-sm">
                  <p className="font-mono text-[14px] font-medium text-primary-light" style={{ letterSpacing: "-0.04em" }}>246.913,57</p>
                  <p className="font-mono text-[0.65rem] text-gray/50">Data Value 14px / 500</p>
                </div>
                <div className="flex items-baseline justify-between max-w-sm">
                  <p className="font-mono text-[24px] font-bold text-white" style={{ letterSpacing: "-0.02em" }}>1.234.567,89 <span className="text-[14px] text-gray">RON</span></p>
                  <p className="font-mono text-[0.65rem] text-gray/50">KPI 24px / 700</p>
                </div>
                <div className="flex items-baseline justify-between max-w-sm">
                  <p className="font-mono text-[13px] text-gray-light" style={{ letterSpacing: "-0.02em" }}>456.789,00</p>
                  <p className="font-mono text-[0.65rem] text-gray/50">Table 13px / 400</p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Danubian reference */}
        <Card>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray mb-4">Reference — Danubian.com Type Scale (Figma extract)</h3>
          <div className="space-y-1 font-mono text-xs text-gray-light">
            <p><span className="text-white">92px</span> — Hero heading, Altform 600, lh 102%, ls -0.04em</p>
            <p><span className="text-white">42px</span> — Section titles + large body, Altform 600, lh 99-115%, ls -0.04em</p>
            <p><span className="text-white">30px</span> — Card headings, Altform 600, lh 99%, ls -0.04em</p>
            <p><span className="text-white">28px</span> — Product/person names, Altform 600, lh 99%, ls -0.04em</p>
            <p><span className="text-white">18px</span> — Body text, Altform 400, lh 127%, ls -0.02em</p>
            <p><span className="text-white">18px</span> — Links, Altform 600, lh 99%, ls -0.04em, underline</p>
            <p><span className="text-white">14px</span> — Labels (DM Mono 400, uppercase) + Values (DM Mono 500, right-aligned)</p>
            <p><span className="text-white">12px</span> — Small tagline, DM Mono 500, centered</p>
            <p className="pt-2 text-gray">Colors: <span className="text-white">#003137</span> headings · <span className="text-white">#254448</span> body · <span className="text-white">#657173</span> muted · <span className="text-white">#BFB4EC</span> accent values</p>
            <p className="text-gray">Costify scales this down ~50% for dashboard density (92→48, 42→20-28, 18→14, 14→11-14)</p>
          </div>
        </Card>
      </Section>

      {/* ─── SPACING & RADIUS ─── */}
      <Section title="Spacing & Radius" description="Consistent spacing scale and border radius for visual harmony.">
        <Card>
          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray">Border Radius</h3>
            <div className="flex items-end gap-6">
              {[
                { label: "sm (6px)", r: "rounded-md", size: "h-10 w-10" },
                { label: "md (8px)", r: "rounded-lg", size: "h-12 w-12" },
                { label: "lg (10px)", r: "rounded-[10px]", size: "h-14 w-14" },
                { label: "xl (12px)", r: "rounded-xl", size: "h-16 w-16" },
              ].map((item) => (
                <div key={item.label} className="flex flex-col items-center gap-2">
                  <div className={`${item.size} ${item.r} border-2 border-primary bg-primary/10`} />
                  <span className="text-[0.65rem] text-gray">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
        <Card>
          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray">Spacing Scale</h3>
            <div className="space-y-2">
              {[
                { label: "4px (1)", w: "w-1" },
                { label: "8px (2)", w: "w-2" },
                { label: "12px (3)", w: "w-3" },
                { label: "16px (4)", w: "w-4" },
                { label: "20px (5)", w: "w-5" },
                { label: "24px (6)", w: "w-6" },
                { label: "32px (8)", w: "w-8" },
                { label: "40px (10)", w: "w-10" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <div className={`h-2.5 rounded-sm bg-primary/60 ${item.w}`} />
                  <span className="text-[0.65rem] font-mono text-gray">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </Section>

      {/* ─── SCROLLBARS ─── */}
      <Section title="Scrollbars" description="Refined, subtle scrollbars for scrollable regions. Use the scrollbar-thin utility class on any overflow container.">
        <Card>
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray">scrollbar-thin (recommended)</h3>
              <p className="mb-3 text-[12px] text-gray-light">
                6px wide, teal-tinted thumb, transparent track. Visible while scrolling, respects dark/light theme via CSS variables. Used on docs sidebar, long tables, modal content.
              </p>
              <div className="scrollbar-thin h-48 overflow-y-auto rounded-lg border border-dark-3 bg-dark-2 p-4">
                <div className="space-y-2 font-mono text-[11px] text-gray-light">
                  {Array.from({ length: 30 }).map((_, i) => (
                    <div key={i} className="flex justify-between">
                      <span>Line item {i + 1}</span>
                      <span className="text-primary-light">{((i * 347.83 + 1234.56) % 10000).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <p className="mt-2 font-mono text-[10px] text-gray">className=&quot;scrollbar-thin overflow-y-auto&quot;</p>
            </div>

            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray">Default browser scrollbar</h3>
              <p className="mb-3 text-[12px] text-gray-light">
                For comparison. The default is wider (~15px), has a solid track, and feels heavier. Avoid for sidebars, popovers, and tight layouts.
              </p>
              <div className="h-48 overflow-y-auto rounded-lg border border-dark-3 bg-dark-2 p-4">
                <div className="space-y-2 font-mono text-[11px] text-gray-light">
                  {Array.from({ length: 30 }).map((_, i) => (
                    <div key={i} className="flex justify-between">
                      <span>Line item {i + 1}</span>
                      <span className="text-primary-light">{((i * 529.17 + 2876.34) % 10000).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <p className="mt-2 font-mono text-[10px] text-gray">className=&quot;overflow-y-auto&quot;</p>
            </div>
          </div>

          <div className="mt-6 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary-light">When to use</h3>
            <ul className="space-y-1 text-[12px] text-gray-light">
              <li>✓ Sidebars with many items (docs sidebar, client list panel)</li>
              <li>✓ Modal content that can overflow (long forms, lists)</li>
              <li>✓ Chat panels, Costi conversation history</li>
              <li>✓ Any overflow container narrower than ~400px where the default scrollbar dominates visually</li>
              <li className="mt-2 text-gray">✗ Not needed on main page scroll (body) — keep native scrollbar for the document itself</li>
            </ul>
          </div>
        </Card>
      </Section>

      {/* ─── BUTTONS ─── */}
      <Section title="Buttons" description="Three variants: primary for main actions, ghost for secondary, danger for destructive.">
        <Card>
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary">Importa Date</Button>
              <Button variant="primary"><Upload size={15} /> Incarca Fisier</Button>
              <Button variant="primary" disabled>Procesare...</Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="ghost">Anuleaza</Button>
              <Button variant="ghost"><Download size={15} /> Exporta PDF</Button>
              <Button variant="ghost" disabled>Indisponibil</Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="danger">Sterge Client</Button>
              <Button variant="danger" disabled>Sterge</Button>
            </div>
          </div>
        </Card>
      </Section>

      {/* ─── INPUTS ─── */}
      <Section title="Inputs" description="Clean, high-contrast fields with clear labels and error states.">
        <Card>
          <div className="grid max-w-md gap-5">
            <Input id="demo-name" label="Nume Client" placeholder="SC Exemplu SRL" />
            <Input id="demo-cui" label="CUI" placeholder="RO12345678" />
            <Input id="demo-err" label="Email" placeholder="user@exemplu.ro" error="Adresa de email invalida" />
            <Input id="demo-dis" label="Cod CAEN" placeholder="6201" disabled />
          </div>
        </Card>
      </Section>

      {/* ─── ALERTS / STATUS ─── */}
      <Section title="Status Messages" description="Semantic color coding for feedback. Green = success, red = error, yellow = warning, blue = info.">
        <div className="grid gap-3 max-w-lg">
          <div className="flex items-center gap-3 rounded-lg border border-green/20 bg-green/5 px-4 py-3">
            <CheckCircle2 size={18} className="text-green shrink-0" />
            <p className="text-sm text-gray-light">Import finalizat cu succes. <strong className="text-white">2.847 inregistrari</strong> procesate.</p>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-danger/20 bg-danger/5 px-4 py-3">
            <XCircle size={18} className="text-danger shrink-0" />
            <p className="text-sm text-gray-light">Eroare la sincronizare. Verificati formatul fisierului.</p>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-warn/20 bg-warn/5 px-4 py-3">
            <AlertTriangle size={18} className="text-warn shrink-0" />
            <p className="text-sm text-gray-light">Termen fiscal in <strong className="text-white">3 zile</strong>. Declaratia 300 trebuie depusa.</p>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
            <Info size={18} className="text-primary-light shrink-0" />
            <p className="text-sm text-gray-light">Se proceseaza datele. Aceasta poate dura cateva secunde.</p>
          </div>
        </div>
      </Section>

      {/* ─── KPI CARDS ─── */}
      <Section title="KPI Cards" description="The primary data display unit. Compact, scannable, with trend indicators.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Disponibil" value="234.567 RON" change="+12,3% vs luna trecuta" positive />
          <KpiCard label="Creante" value="89.012 RON" change="-5,1% vs luna trecuta" positive={false} />
          <KpiCard label="Datorii" value="156.789 RON" change="+2,8% vs luna trecuta" positive={false} />
          <KpiCard label="Profit Net" value="45.678 RON" change="+18,7% vs luna trecuta" positive />
        </div>
      </Section>

      {/* ─── DATA TABLE SAMPLE ─── */}
      <Section title="Data Tables" description="Compact, monospaced numbers, alternating subtle rows. Right-align financial columns.">
        <Card className="overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dark-3 bg-dark-3/30">
                <th className="px-4 py-2.5 text-left text-[0.69rem] font-semibold uppercase tracking-wider text-gray">Cont</th>
                <th className="px-4 py-2.5 text-left text-[0.69rem] font-semibold uppercase tracking-wider text-gray">Denumire</th>
                <th className="px-4 py-2.5 text-right text-[0.69rem] font-semibold uppercase tracking-wider text-gray">Debit</th>
                <th className="px-4 py-2.5 text-right text-[0.69rem] font-semibold uppercase tracking-wider text-gray">Credit</th>
                <th className="px-4 py-2.5 text-right text-[0.69rem] font-semibold uppercase tracking-wider text-gray">Sold Final</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-3/50">
              {[
                { cont: "5121", den: "Conturi la banci in lei", d: "1.234.567,89", c: "987.654,32", s: "246.913,57", pos: true },
                { cont: "4111", den: "Clienti", d: "567.890,00", c: "478.901,23", s: "88.988,77", pos: true },
                { cont: "401", den: "Furnizori", d: "345.678,90", c: "456.789,01", s: "111.110,11", pos: false },
                { cont: "6xx", den: "Cheltuieli de exploatare", d: "234.567,89", c: "0,00", s: "234.567,89", pos: true },
                { cont: "7xx", den: "Venituri din exploatare", d: "0,00", c: "345.678,90", s: "345.678,90", pos: false },
              ].map((row) => (
                <tr key={row.cont} className="hover:bg-dark-3/20 transition-colors">
                  <td className="px-4 py-2 font-mono text-[0.81rem] font-semibold text-primary">{row.cont}</td>
                  <td className="px-4 py-2 text-gray-light">{row.den}</td>
                  <td className="px-4 py-2 text-right font-mono text-[0.81rem] text-gray-light">{row.d}</td>
                  <td className="px-4 py-2 text-right font-mono text-[0.81rem] text-gray-light">{row.c}</td>
                  <td className={`px-4 py-2 text-right font-mono text-[0.81rem] font-semibold ${row.pos ? "text-green" : "text-danger"}`}>{row.s}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </Section>

      {/* ─── ICONOGRAPHY ─── */}
      <Section title="Iconography" description="Lucide icons at 16-20px. Consistent stroke weight. Used for navigation, actions, and status.">
        <Card>
          <div className="flex flex-wrap gap-6">
            {[
              { icon: Users, label: "Clienti" },
              { icon: FileBarChart, label: "Rapoarte" },
              { icon: Settings, label: "Setari" },
              { icon: MessageCircle, label: "Chat" },
              { icon: Upload, label: "Import" },
              { icon: Download, label: "Export" },
              { icon: Search, label: "Cauta" },
              { icon: Plus, label: "Adauga" },
              { icon: ChevronRight, label: "Navighare" },
              { icon: TrendingUp, label: "Crestere" },
              { icon: TrendingDown, label: "Scadere" },
              { icon: AlertTriangle, label: "Atentie" },
              { icon: CheckCircle2, label: "Succes" },
              { icon: XCircle, label: "Eroare" },
              { icon: Info, label: "Info" },
            ].map((item) => (
              <div key={item.label} className="flex flex-col items-center gap-1.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-dark-3 bg-dark-3/30">
                  <item.icon size={18} className="text-gray-light" />
                </div>
                <span className="text-[0.6rem] text-gray">{item.label}</span>
              </div>
            ))}
          </div>
        </Card>
      </Section>

      {/* ─── SHADOWS & ELEVATION ─── */}
      <Section title="Elevation" description="Subtle shadows for depth. Three levels: flat, raised, floating.">
        <div className="flex flex-wrap gap-6">
          <div className="flex flex-col items-center gap-2">
            <div className="h-20 w-28 rounded-xl border border-dark-3 bg-dark-2" />
            <span className="text-[0.65rem] text-gray">Flat (cards)</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="h-20 w-28 rounded-xl border border-dark-3 bg-dark-2 shadow-md shadow-black/20" />
            <span className="text-[0.65rem] text-gray">Raised (dropdowns)</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="h-20 w-28 rounded-xl border border-dark-3 bg-dark-2 shadow-xl shadow-black/30" />
            <span className="text-[0.65rem] text-gray">Floating (modals)</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="h-20 w-28 rounded-xl bg-primary shadow-[0_4px_20px_rgba(108,92,231,0.25)]" />
            <span className="text-[0.65rem] text-gray">Glow (CTAs)</span>
          </div>
        </div>
      </Section>

      {/* ─── LOGO ─── */}
      <Section title="Logo Proposals" description="Exploring directions for the Costify wordmark. All use Altform Bold with -0.04em tracking.">

        {/* Current */}
        <Card>
          <p className="font-mono text-[0.65rem] text-gray mb-4">Current — Pure wordmark, lowercase</p>
          <div className="flex flex-wrap items-end gap-10">
            <Logo size="sm" />
            <Logo size="md" />
            <Logo size="lg" />
          </div>
        </Card>

        {/* Proposal A — Accent on "fy" */}
        {PALETTES.map((p) => (
          <Card key={`logo-${p.name}`}>
            <p className="font-mono text-[0.65rem] text-gray mb-4">With {p.name} accent on &ldquo;fy&rdquo;</p>
            <div className="flex flex-wrap items-end gap-10">
              <span className="text-[16px] font-bold text-white" style={{ letterSpacing: "-0.04em" }}>
                costi<span style={{ color: p.primary }}>fy</span>
              </span>
              <span className="text-[20px] font-bold text-white" style={{ letterSpacing: "-0.04em" }}>
                costi<span style={{ color: p.primary }}>fy</span>
              </span>
              <span className="text-[28px] font-bold text-white" style={{ letterSpacing: "-0.04em" }}>
                costi<span style={{ color: p.primary }}>fy</span>
              </span>
              <span className="text-[48px] font-bold text-white" style={{ letterSpacing: "-0.04em" }}>
                costi<span style={{ color: p.primary }}>fy</span>
              </span>
            </div>
          </Card>
        ))}

        {/* Proposal B — Dot accent */}
        <Card>
          <p className="font-mono text-[0.65rem] text-gray mb-4">Dot accent — period as brand mark</p>
          <div className="flex flex-wrap items-end gap-10">
            {["#4338CA", "#475BE8", "#0F766E", "#1E3A5F", "#5046A5", "#3D3462"].map((c) => (
              <span key={`dot-${c}`} className="text-[28px] font-bold text-white" style={{ letterSpacing: "-0.04em" }}>
                costify<span style={{ color: c }}>.</span>
              </span>
            ))}
          </div>
        </Card>

        {/* Proposal C — Monogram C */}
        <Card>
          <p className="font-mono text-[0.65rem] text-gray mb-4">Monogram — &ldquo;C&rdquo; mark + wordmark</p>
          <div className="flex flex-wrap items-end gap-10">
            {PALETTES.map((p) => (
              <div key={`mono-${p.name}`} className="flex items-center gap-2.5">
                <div className="flex items-center justify-center rounded-lg" style={{ backgroundColor: p.primary, width: 32, height: 32 }}>
                  <span className="text-[18px] font-bold" style={{ color: "#E9E8E3", letterSpacing: "-0.04em" }}>c</span>
                </div>
                <span className="text-[20px] font-bold text-white" style={{ letterSpacing: "-0.04em" }}>costify</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Proposal D — Slash separator */}
        <Card>
          <p className="font-mono text-[0.65rem] text-gray mb-4">Slash — cost/ify separator</p>
          <div className="flex flex-wrap items-end gap-10">
            {PALETTES.map((p) => (
              <span key={`slash-${p.name}`} className="text-[28px] font-bold text-white" style={{ letterSpacing: "-0.04em" }}>
                cost<span style={{ color: p.primary }}>/</span>ify
              </span>
            ))}
          </div>
        </Card>

        {/* Proposal E — Uppercase with ligature feel */}
        <Card>
          <p className="font-mono text-[0.65rem] text-gray mb-4">Uppercase — COSTIFY, all caps</p>
          <div className="flex flex-wrap items-end gap-10">
            {PALETTES.map((p) => (
              <span key={`upper-${p.name}`} className="text-[28px] font-bold text-white" style={{ letterSpacing: "-0.02em" }}>
                COSTI<span style={{ color: p.primary }}>FY</span>
              </span>
            ))}
          </div>
        </Card>

        {/* On light background */}
        <div className="rounded-xl p-6 space-y-6" style={{ backgroundColor: "#F0EFEA" }}>
          <p className="font-mono text-[0.65rem]" style={{ color: "#7A766E" }}>Light theme previews</p>
          <div className="flex flex-wrap items-end gap-10">
            {PALETTES.map((p) => (
              <span key={`light-${p.name}`} className="text-[28px] font-bold" style={{ letterSpacing: "-0.04em", color: "#1A1918" }}>
                costi<span style={{ color: p.primary }}>fy</span>
              </span>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-10">
            {PALETTES.map((p) => (
              <span key={`light-dot-${p.name}`} className="text-[28px] font-bold" style={{ letterSpacing: "-0.04em", color: "#1A1918" }}>
                costify<span style={{ color: p.primary }}>.</span>
              </span>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-8">
            {PALETTES.map((p) => (
              <div key={`light-mono-${p.name}`} className="flex items-center gap-2.5">
                <div className="flex items-center justify-center rounded-lg" style={{ backgroundColor: p.primary, width: 32, height: 32 }}>
                  <span className="text-[18px] font-bold" style={{ color: "#E9E8E3", letterSpacing: "-0.04em" }}>c</span>
                </div>
                <span className="text-[20px] font-bold" style={{ letterSpacing: "-0.04em", color: "#1A1918" }}>costify</span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ─── MASCOT ─── */}
      <Section title="Costi — Mascot" description="The friendly face of Costify. Used for empty states, onboarding, loading, and contextual guidance. 9 expressive states.">
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
          {costiStates.map((state) => (
            <Card key={state} className="flex flex-col items-center gap-3 py-6">
              <CostiMascot state={state} size={120} />
              <div className="text-center">
                <p className="text-sm font-semibold text-white capitalize">{state}</p>
                <p className="text-[0.65rem] text-gray">
                  {{
                    greeting: "Salut! Onboarding, welcome screens",
                    thinking: "Procesare date, asteptare rezultat",
                    success: "Import reusit, operatie finalizata",
                    alert: "Depasire buget, termen fiscal",
                    error: "Eroare sincronizare, import esuat",
                    working: "Calcul balanta, generare raport",
                    celebrating: "Target atins, rezultat excelent",
                    sleeping: "Inactivitate, fara date recente",
                    teaching: "Tips, ghidare, explicatii",
                  }[state]}
                </p>
              </div>
            </Card>
          ))}
        </div>
      </Section>

      {/* ─── VOICE & TONE ─── */}
      {/* ─── UI COMPONENTS CATALOG ─── */}
      <Section title="UI Components" description="Toate elementele vizuale folosite in aplicatie — forme, selectoare, tabele, grafice, badge-uri, progress, tooltips.">

        {/* Select / Combobox */}
        <Card>
          <p className="font-mono text-[0.65rem] text-gray mb-4">Select / Combobox</p>
          <div className="grid gap-5 max-w-lg">
            <div className="space-y-1.5">
              <label className="block font-mono text-[11px] font-medium uppercase text-gray" style={{ letterSpacing: "-0.04em" }}>Perioada</label>
              <select className="w-full rounded-lg border border-dark-3 bg-dark-2 px-3.5 py-2.5 text-[14px] text-gray-light outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary/30 appearance-none cursor-pointer">
                <option>Ianuarie 2024</option>
                <option>Februarie 2024</option>
                <option>Martie 2024</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block font-mono text-[11px] font-medium uppercase text-gray" style={{ letterSpacing: "-0.04em" }}>Client</label>
              <select className="w-full rounded-lg border border-dark-3 bg-dark-2 px-3.5 py-2.5 text-[14px] text-gray-light outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary/30 appearance-none cursor-pointer">
                <option>SC Exemplu SRL</option>
                <option>SC Demo SA</option>
                <option>PFA Ion Popescu</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block font-mono text-[11px] font-medium uppercase text-gray" style={{ letterSpacing: "-0.04em" }}>Tip raport</label>
              <select disabled className="w-full rounded-lg border border-dark-3 bg-dark-2 px-3.5 py-2.5 text-[14px] text-gray/50 outline-none opacity-50 cursor-not-allowed">
                <option>Bilant F10</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Textarea */}
        <Card>
          <p className="font-mono text-[0.65rem] text-gray mb-4">Textarea</p>
          <div className="max-w-lg space-y-1.5">
            <label className="block font-mono text-[11px] font-medium uppercase text-gray" style={{ letterSpacing: "-0.04em" }}>Notite</label>
            <textarea
              rows={3}
              placeholder="Adauga notite despre acest client..."
              className="w-full rounded-lg border border-dark-3 bg-dark-2 px-3.5 py-2.5 text-[14px] text-gray-light placeholder:text-gray/60 outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary/30 resize-none"
            />
          </div>
        </Card>

        {/* Checkbox & Radio */}
        <Card>
          <p className="font-mono text-[0.65rem] text-gray mb-4">Checkbox & Radio</p>
          <div className="grid gap-6 sm:grid-cols-2 max-w-lg">
            <div className="space-y-3">
              <p className="font-mono text-[11px] font-medium uppercase text-gray" style={{ letterSpacing: "-0.04em" }}>Checkbox</p>
              {["Bilant F10", "CPP F20", "Balanta de verificare"].map((label) => (
                <label key={label} className="flex items-center gap-2.5 cursor-pointer group">
                  <input type="checkbox" className="h-4 w-4 rounded border-dark-3 bg-dark-2 text-primary accent-primary cursor-pointer" defaultChecked={label === "Bilant F10"} />
                  <span className="text-[14px] text-gray-light group-hover:text-white transition-colors">{label}</span>
                </label>
              ))}
            </div>
            <div className="space-y-3">
              <p className="font-mono text-[11px] font-medium uppercase text-gray" style={{ letterSpacing: "-0.04em" }}>Radio</p>
              {["Luna curenta", "Trimestru", "An complet"].map((label) => (
                <label key={label} className="flex items-center gap-2.5 cursor-pointer group">
                  <input type="radio" name="period" className="h-4 w-4 border-dark-3 bg-dark-2 text-primary accent-primary cursor-pointer" defaultChecked={label === "Luna curenta"} />
                  <span className="text-[14px] text-gray-light group-hover:text-white transition-colors">{label}</span>
                </label>
              ))}
            </div>
          </div>
        </Card>

        {/* Toggle Switch */}
        <Card>
          <p className="font-mono text-[0.65rem] text-gray mb-4">Toggle</p>
          <div className="space-y-4 max-w-sm">
            {[
              { label: "Afiseaza conturi analitice", on: true },
              { label: "Include conturi cu sold zero", on: false },
              { label: "Grupeaza pe clase", on: true },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <span className="text-[14px] text-gray-light">{item.label}</span>
                <div className={`w-10 h-5.5 rounded-full p-0.5 cursor-pointer transition-colors ${item.on ? "bg-primary" : "bg-dark-3"}`}>
                  <div className={`h-4.5 w-4.5 rounded-full bg-white shadow transition-transform ${item.on ? "translate-x-4.5" : "translate-x-0"}`} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Badges & Tags */}
        <Card>
          <p className="font-mono text-[0.65rem] text-gray mb-4">Badges & Tags</p>
          <div className="flex flex-wrap gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold bg-green/10 text-green border border-green/20">
              <CheckCircle2 size={12} /> Activ
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold bg-danger/10 text-danger border border-danger/20">
              <XCircle size={12} /> Esuat
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold bg-warn/10 text-warn border border-warn/20">
              <AlertTriangle size={12} /> In asteptare
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold bg-primary/10 text-primary-light border border-primary/20">
              <Info size={12} /> Procesare
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold bg-primary/10 text-primary-light border border-primary/20">
              Jurnal contabil
            </span>
            <span className="inline-flex items-center rounded-md px-2 py-0.5 font-mono text-[11px] font-medium bg-dark-3 text-gray-light">
              v2.1
            </span>
          </div>
        </Card>

        {/* Progress & Loading */}
        <Card>
          <p className="font-mono text-[0.65rem] text-gray mb-4">Progress & Loading</p>
          <div className="space-y-5 max-w-lg">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="font-mono text-[11px] text-gray uppercase" style={{ letterSpacing: "-0.04em" }}>Import progres</span>
                <span className="font-mono text-[11px] text-primary-light">73%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-dark-3">
                <div className="h-2 rounded-full bg-primary" style={{ width: "73%" }} />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="font-mono text-[11px] text-gray uppercase" style={{ letterSpacing: "-0.04em" }}>Calcul balanta</span>
                <span className="font-mono text-[11px] text-green">100%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-dark-3">
                <div className="h-2 rounded-full bg-green" style={{ width: "100%" }} />
              </div>
            </div>
            <div className="space-y-2">
              <span className="font-mono text-[11px] text-gray uppercase" style={{ letterSpacing: "-0.04em" }}>Skeleton loading</span>
              <div className="space-y-2">
                <div className="h-4 w-3/4 rounded bg-dark-3 animate-pulse" />
                <div className="h-4 w-1/2 rounded bg-dark-3 animate-pulse" />
                <div className="h-4 w-5/6 rounded bg-dark-3 animate-pulse" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <span className="text-[13px] text-gray">Se proceseaza...</span>
            </div>
          </div>
        </Card>

        {/* Tabs */}
        <Card>
          <p className="font-mono text-[0.65rem] text-gray mb-4">Tabs</p>
          <div className="space-y-4">
            <div className="flex gap-1 border-b border-dark-3">
              {["Bilant", "CPP", "Balanta", "Jurnal"].map((tab, i) => (
                <button
                  key={tab}
                  className={`px-4 py-2.5 text-[14px] font-semibold transition-colors border-b-2 -mb-px ${
                    i === 0
                      ? "border-primary text-white"
                      : "border-transparent text-gray hover:text-gray-light"
                  }`}
                  style={{ letterSpacing: "-0.04em" }}
                >
                  {tab}
                </button>
              ))}
            </div>
            <div className="flex gap-1 rounded-lg bg-dark-3/50 p-1">
              {["Lunar", "Trimestrial", "Anual"].map((tab, i) => (
                <button
                  key={tab}
                  className={`flex-1 rounded-md px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                    i === 0
                      ? "bg-primary text-[#E9E8E3] shadow-sm"
                      : "text-gray hover:text-gray-light"
                  }`}
                  style={{ letterSpacing: "-0.04em" }}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* Tooltip & Popover */}
        <Card>
          <p className="font-mono text-[0.65rem] text-gray mb-4">Tooltip</p>
          <div className="flex items-center gap-8">
            <div className="relative group">
              <span className="text-[14px] text-gray-light underline decoration-dashed underline-offset-4 cursor-help">Lichiditate curenta</span>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg bg-dark-3 border border-dark-4 shadow-lg text-[12px] text-gray-light whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                Active curente / Datorii curente
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-2 h-2 rotate-45 bg-dark-3 border-r border-b border-dark-4" />
              </div>
            </div>
            <div className="relative group">
              <span className="text-[14px] text-gray-light underline decoration-dashed underline-offset-4 cursor-help">DSO</span>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg bg-dark-3 border border-dark-4 shadow-lg text-[12px] text-gray-light whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                Days Sales Outstanding — zile medii incasare creante
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-2 h-2 rotate-45 bg-dark-3 border-r border-b border-dark-4" />
              </div>
            </div>
          </div>
        </Card>

        {/* Financial Table — Full */}
        <Card className="overflow-hidden p-0">
          <div className="px-5 py-3 border-b border-dark-3 flex items-center justify-between">
            <p className="font-mono text-[0.65rem] text-gray">Balanta de verificare — Decembrie 2024</p>
            <div className="flex gap-2">
              <button className="rounded-md border border-dark-3 px-2.5 py-1 font-mono text-[11px] text-gray hover:text-white hover:border-primary/30 transition-colors">
                <Download size={11} className="inline mr-1" />Excel
              </button>
              <button className="rounded-md border border-dark-3 px-2.5 py-1 font-mono text-[11px] text-gray hover:text-white hover:border-primary/30 transition-colors">
                <Download size={11} className="inline mr-1" />PDF
              </button>
            </div>
          </div>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-dark-3 bg-dark-3/30">
                <th className="px-4 py-2.5 text-left font-mono text-[11px] font-medium uppercase text-gray" style={{ letterSpacing: "-0.04em" }}>Cont</th>
                <th className="px-4 py-2.5 text-left font-mono text-[11px] font-medium uppercase text-gray" style={{ letterSpacing: "-0.04em" }}>Denumire</th>
                <th className="px-4 py-2.5 text-right font-mono text-[11px] font-medium uppercase text-gray" style={{ letterSpacing: "-0.04em" }}>Sold Initial D</th>
                <th className="px-4 py-2.5 text-right font-mono text-[11px] font-medium uppercase text-gray" style={{ letterSpacing: "-0.04em" }}>Sold Initial C</th>
                <th className="px-4 py-2.5 text-right font-mono text-[11px] font-medium uppercase text-gray" style={{ letterSpacing: "-0.04em" }}>Rulaj D</th>
                <th className="px-4 py-2.5 text-right font-mono text-[11px] font-medium uppercase text-gray" style={{ letterSpacing: "-0.04em" }}>Rulaj C</th>
                <th className="px-4 py-2.5 text-right font-mono text-[11px] font-medium uppercase text-gray" style={{ letterSpacing: "-0.04em" }}>Sold Final D</th>
                <th className="px-4 py-2.5 text-right font-mono text-[11px] font-medium uppercase text-gray" style={{ letterSpacing: "-0.04em" }}>Sold Final C</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-3/50">
              {[
                { cont: "1012", den: "Capital subscris varsat", sid: "", sic: "200.000,00", rd: "0,00", rc: "0,00", sfd: "", sfc: "200.000,00", cls: "1" },
                { cont: "121", den: "Profit si pierdere", sid: "", sic: "45.678,00", rd: "12.300,00", rc: "18.900,00", sfd: "", sfc: "52.278,00", cls: "1" },
                { cont: "2131", den: "Echipamente tehnologice", sid: "156.000,00", sic: "", rd: "23.000,00", rc: "0,00", sfd: "179.000,00", sfc: "", cls: "2" },
                { cont: "2814", den: "Amortizare mijl. transport", sid: "", sic: "34.500,00", rd: "0,00", rc: "2.875,00", sfd: "", sfc: "37.375,00", cls: "2" },
                { cont: "401", den: "Furnizori", sid: "", sic: "89.012,00", rd: "67.890,00", rc: "78.123,00", sfd: "", sfc: "99.245,00", cls: "4" },
                { cont: "4111", den: "Clienti", sid: "123.456,00", sic: "", rd: "234.567,00", rc: "198.765,00", sfd: "159.258,00", sfc: "", cls: "4" },
                { cont: "5121", den: "Conturi la banci in lei", sid: "234.567,00", sic: "", rd: "456.789,00", rc: "412.345,00", sfd: "279.011,00", sfc: "", cls: "5" },
                { cont: "5311", den: "Casa in lei", sid: "12.345,00", sic: "", rd: "5.678,00", rc: "8.901,00", sfd: "9.122,00", sfc: "", cls: "5" },
                { cont: "6022", den: "Cheltuieli mat. consumabile", sid: "", sic: "", rd: "15.678,00", rc: "0,00", sfd: "15.678,00", sfc: "", cls: "6" },
                { cont: "641", den: "Cheltuieli cu salariile", sid: "", sic: "", rd: "87.654,00", rc: "0,00", sfd: "87.654,00", sfc: "", cls: "6" },
                { cont: "704", den: "Venituri din prestari servicii", sid: "", sic: "", rd: "0,00", rc: "345.678,00", sfd: "", sfc: "345.678,00", cls: "7" },
                { cont: "7588", den: "Alte venituri din exploatare", sid: "", sic: "", rd: "0,00", rc: "12.345,00", sfd: "", sfc: "12.345,00", cls: "7" },
              ].map((row) => (
                <tr key={row.cont} className="hover:bg-dark-3/20 transition-colors">
                  <td className="px-4 py-2 font-mono text-[12px] font-semibold text-primary-light">{row.cont}</td>
                  <td className="px-4 py-2 text-gray-light">{row.den}</td>
                  <td className="px-4 py-2 text-right font-mono text-[12px] text-gray-light">{row.sid || <span className="text-dark-3">—</span>}</td>
                  <td className="px-4 py-2 text-right font-mono text-[12px] text-gray-light">{row.sic || <span className="text-dark-3">—</span>}</td>
                  <td className="px-4 py-2 text-right font-mono text-[12px] text-gray-light">{row.rd}</td>
                  <td className="px-4 py-2 text-right font-mono text-[12px] text-gray-light">{row.rc}</td>
                  <td className={`px-4 py-2 text-right font-mono text-[12px] font-semibold ${row.sfd ? "text-green" : ""}`}>{row.sfd || <span className="text-dark-3">—</span>}</td>
                  <td className={`px-4 py-2 text-right font-mono text-[12px] font-semibold ${row.sfc ? "text-danger" : ""}`}>{row.sfc || <span className="text-dark-3">—</span>}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-dark-3 bg-dark-3/20">
                <td className="px-4 py-2.5 font-semibold text-white" colSpan={2}>TOTAL</td>
                <td className="px-4 py-2.5 text-right font-mono text-[12px] font-bold text-white">526.368,00</td>
                <td className="px-4 py-2.5 text-right font-mono text-[12px] font-bold text-white">369.190,00</td>
                <td className="px-4 py-2.5 text-right font-mono text-[12px] font-bold text-white">903.556,00</td>
                <td className="px-4 py-2.5 text-right font-mono text-[12px] font-bold text-white">1.078.832,00</td>
                <td className="px-4 py-2.5 text-right font-mono text-[12px] font-bold text-green">729.723,00</td>
                <td className="px-4 py-2.5 text-right font-mono text-[12px] font-bold text-danger">746.921,00</td>
              </tr>
            </tfoot>
          </table>
        </Card>

        {/* Charts with Recharts */}
        <Card>
          <p className="font-mono text-[0.65rem] text-gray mb-4">Venituri vs Cheltuieli — Bar Chart</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={[
              { month: "Ian", venituri: 85, cheltuieli: 62 },
              { month: "Feb", venituri: 72, cheltuieli: 58 },
              { month: "Mar", venituri: 98, cheltuieli: 71 },
              { month: "Apr", venituri: 110, cheltuieli: 85 },
              { month: "Mai", venituri: 95, cheltuieli: 78 },
              { month: "Iun", venituri: 120, cheltuieli: 92 },
              { month: "Iul", venituri: 88, cheltuieli: 95 },
              { month: "Aug", venituri: 105, cheltuieli: 82 },
              { month: "Sep", venituri: 130, cheltuieli: 88 },
              { month: "Oct", venituri: 115, cheltuieli: 90 },
              { month: "Nov", venituri: 140, cheltuieli: 95 },
              { month: "Dec", venituri: 155, cheltuieli: 102 },
            ]} barGap={2} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="#21262D" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: "#8A877F", fontSize: 11, fontFamily: "var(--font-mono)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#8A877F", fontSize: 11, fontFamily: "var(--font-mono)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}K`} />
              <RTooltip contentStyle={{ backgroundColor: "#161B22", border: "1px solid #21262D", borderRadius: 8, fontSize: 12, fontFamily: "var(--font-mono)" }} labelStyle={{ color: "#E9E8E3" }} itemStyle={{ color: "#C5C3BC" }} formatter={(v: unknown) => `${v}K RON`} />
              <Bar dataKey="venituri" fill="#0D6B5E" radius={[4, 4, 0, 0]} />
              <Bar dataKey="cheltuieli" fill="#EF4444" radius={[4, 4, 0, 0]} opacity={0.6} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <p className="font-mono text-[0.65rem] text-gray mb-4">Cash Flow — Area Chart</p>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={[
              { month: "Ian", cash: 234, creante: 89, datorii: 156 },
              { month: "Feb", cash: 248, creante: 95, datorii: 148 },
              { month: "Mar", cash: 225, creante: 110, datorii: 162 },
              { month: "Apr", cash: 268, creante: 85, datorii: 145 },
              { month: "Mai", cash: 290, creante: 78, datorii: 138 },
              { month: "Iun", cash: 310, creante: 92, datorii: 155 },
              { month: "Iul", cash: 285, creante: 105, datorii: 168 },
              { month: "Aug", cash: 325, creante: 88, datorii: 142 },
              { month: "Sep", cash: 348, creante: 95, datorii: 135 },
              { month: "Oct", cash: 335, creante: 102, datorii: 148 },
              { month: "Nov", cash: 362, creante: 78, datorii: 130 },
              { month: "Dec", cash: 395, creante: 72, datorii: 125 },
            ]}>
              <defs>
                <linearGradient id="gradCash" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0D6B5E" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#0D6B5E" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradCreante" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#21262D" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: "#8A877F", fontSize: 11, fontFamily: "var(--font-mono)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#8A877F", fontSize: 11, fontFamily: "var(--font-mono)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}K`} />
              <RTooltip contentStyle={{ backgroundColor: "#161B22", border: "1px solid #21262D", borderRadius: 8, fontSize: 12, fontFamily: "var(--font-mono)" }} labelStyle={{ color: "#E9E8E3" }} itemStyle={{ color: "#C5C3BC" }} formatter={(v: unknown) => `${v}K RON`} />
              <Area type="monotone" dataKey="cash" stroke="#0D6B5E" strokeWidth={2} fill="url(#gradCash)" />
              <Area type="monotone" dataKey="creante" stroke="#3B82F6" strokeWidth={1.5} fill="url(#gradCreante)" />
              <Area type="monotone" dataKey="datorii" stroke="#EF4444" strokeWidth={1.5} fill="none" strokeDasharray="4 4" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <p className="font-mono text-[0.65rem] text-gray mb-4">Structura Cheltuieli — Pie Chart</p>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={[
                    { name: "Salarii", value: 87654 },
                    { name: "Furnizori", value: 45890 },
                    { name: "Utilitati", value: 12345 },
                    { name: "Amortizare", value: 8900 },
                    { name: "Alte chelt.", value: 15678 },
                  ]}
                  cx="50%" cy="50%"
                  innerRadius={55} outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                >
                  {["#0D6B5E", "#3B82F6", "#F59E0B", "#6366F1", "#8A877F"].map((color, i) => (
                    <Cell key={i} fill={color} />
                  ))}
                </Pie>
                <RTooltip contentStyle={{ backgroundColor: "#161B22", border: "1px solid #21262D", borderRadius: 8, fontSize: 12, fontFamily: "var(--font-mono)" }} formatter={(v: unknown) => `${(Number(v) / 1000).toFixed(1)}K RON`} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "#8A877F" }} />
              </PieChart>
            </ResponsiveContainer>
          </Card>

          <Card>
            <p className="font-mono text-[0.65rem] text-gray mb-4">Profit Net — Line Chart</p>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={[
                { month: "Ian", actual: 23, buget: 20 },
                { month: "Feb", actual: 14, buget: 22 },
                { month: "Mar", actual: 27, buget: 24 },
                { month: "Apr", actual: 25, buget: 26 },
                { month: "Mai", actual: 17, buget: 25 },
                { month: "Iun", actual: 28, buget: 27 },
                { month: "Iul", actual: -7, buget: 20 },
                { month: "Aug", actual: 23, buget: 22 },
                { month: "Sep", actual: 42, buget: 30 },
                { month: "Oct", actual: 25, buget: 28 },
                { month: "Nov", actual: 45, buget: 32 },
                { month: "Dec", actual: 53, buget: 35 },
              ]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#21262D" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: "#8A877F", fontSize: 11, fontFamily: "var(--font-mono)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#8A877F", fontSize: 11, fontFamily: "var(--font-mono)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}K`} />
                <RTooltip contentStyle={{ backgroundColor: "#161B22", border: "1px solid #21262D", borderRadius: 8, fontSize: 12, fontFamily: "var(--font-mono)" }} labelStyle={{ color: "#E9E8E3" }} formatter={(v: unknown) => `${v}K RON`} />
                <Line type="monotone" dataKey="actual" stroke="#34D3A0" strokeWidth={2.5} dot={{ fill: "#34D3A0", r: 3 }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="buget" stroke="#8A877F" strokeWidth={1.5} strokeDasharray="6 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </div>

        <Card>
          <p className="font-mono text-[0.65rem] text-gray mb-4">KPI Gauges — Radial Bar</p>
          <div className="grid grid-cols-3 gap-4">
            {[
              { name: "Lichiditate", value: 78, target: 100, color: "#0D6B5E" },
              { name: "Solvabilitate", value: 92, target: 100, color: "#34D3A0" },
              { name: "Grad Indatorare", value: 45, target: 100, color: "#F59E0B" },
            ].map((kpi) => (
              <div key={kpi.name} className="flex flex-col items-center">
                <ResponsiveContainer width={120} height={120}>
                  <RadialBarChart cx="50%" cy="50%" innerRadius="65%" outerRadius="90%" startAngle={210} endAngle={-30} data={[{ value: kpi.value, fill: kpi.color }]}>
                    <RadialBar background={{ fill: "#21262D" }} dataKey="value" cornerRadius={6} />
                  </RadialBarChart>
                </ResponsiveContainer>
                <div className="-mt-4 text-center">
                  <p className="font-mono text-[18px] font-bold text-white">{kpi.value}%</p>
                  <p className="font-mono text-[10px] text-gray uppercase" style={{ letterSpacing: "-0.04em" }}>{kpi.name}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Empty States */}
        <Card>
          <p className="font-mono text-[0.65rem] text-gray mb-4">Empty States</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-dark-3 py-10">
              <Building2 size={40} className="mb-3 text-gray/30" />
              <p className="text-[14px] font-semibold text-white" style={{ letterSpacing: "-0.04em" }}>Niciun client</p>
              <p className="mt-1 text-[13px] text-gray">Adauga primul tau client</p>
              <Button className="mt-4">
                <Plus size={14} /> Adauga Client
              </Button>
            </div>
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-dark-3 py-10">
              <Upload size={40} className="mb-3 text-gray/30" />
              <p className="text-[14px] font-semibold text-white" style={{ letterSpacing: "-0.04em" }}>Niciun import</p>
              <p className="mt-1 text-[13px] text-gray">Incarca un fisier XLSX cu jurnalul contabil</p>
              <Button variant="ghost" className="mt-4">
                <Upload size={14} /> Importa Date
              </Button>
            </div>
          </div>
        </Card>

        {/* Pagination */}
        <Card>
          <p className="font-mono text-[0.65rem] text-gray mb-4">Pagination</p>
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] text-gray">Afisez 1-20 din 847 inregistrari</span>
            <div className="flex gap-1">
              {["<", "1", "2", "3", "...", "42", "43", ">"].map((p, i) => (
                <button
                  key={`${p}-${i}`}
                  className={`min-w-[32px] rounded-md px-2.5 py-1.5 font-mono text-[12px] font-medium transition-colors ${
                    p === "1"
                      ? "bg-primary text-[#E9E8E3]"
                      : "text-gray hover:bg-dark-3/50 hover:text-white"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* Search */}
        <Card>
          <p className="font-mono text-[0.65rem] text-gray mb-4">Search</p>
          <div className="max-w-sm relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray" />
            <input
              type="text"
              placeholder="Cauta cont, client, partener..."
              className="w-full rounded-lg border border-dark-3 bg-dark-2 pl-10 pr-3.5 py-2.5 text-[14px] text-gray-light placeholder:text-gray/60 outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary/30"
            />
          </div>
        </Card>

      </Section>

      {/* ─── VOICE & TONE ─── */}
      <Section title="Voice & Tone" description="How Costify speaks to users.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-green mb-3">Do</h3>
            <ul className="space-y-2 text-sm text-gray-light">
              <li>&ldquo;Import finalizat — 2.847 inregistrari procesate.&rdquo;</li>
              <li>&ldquo;Termen fiscal in 3 zile: Declaratia 300.&rdquo;</li>
              <li>&ldquo;Verifica formatul fisierului si incearca din nou.&rdquo;</li>
              <li>&ldquo;Lichiditatea curenta este sub pragul recomandat.&rdquo;</li>
            </ul>
          </Card>
          <Card>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-danger mb-3">Don&apos;t</h3>
            <ul className="space-y-2 text-sm text-gray-light">
              <li className="line-through opacity-60">&ldquo;Yay! Your file was uploaded successfully! 🎉&rdquo;</li>
              <li className="line-through opacity-60">&ldquo;Oops! Something went wrong. Error code: 0x8F3A.&rdquo;</li>
              <li className="line-through opacity-60">&ldquo;Please be advised that the fiscal deadline is approaching.&rdquo;</li>
              <li className="line-through opacity-60">&ldquo;Click here to see more about your data metrics overview.&rdquo;</li>
            </ul>
          </Card>
        </div>
      </Section>

    </div>
  );
}

import Link from "next/link";
import { Logo } from "@/components/ui/logo";

function GridBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Radial glow */}
      <div
        className="absolute left-1/2 top-[15%] h-[700px] w-[900px] -translate-x-1/2 rounded-full opacity-60"
        style={{
          background: "radial-gradient(ellipse at center, rgba(13,107,94,0.28) 0%, rgba(13,107,94,0.08) 40%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />
      {/* Secondary glow */}
      <div
        className="absolute right-[10%] top-[40%] h-[400px] w-[400px] rounded-full opacity-40"
        style={{
          background: "radial-gradient(circle at center, rgba(99,102,241,0.15) 0%, transparent 65%)",
          filter: "blur(60px)",
        }}
      />
      {/* Grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage: `
            linear-gradient(to right, currentColor 1px, transparent 1px),
            linear-gradient(to bottom, currentColor 1px, transparent 1px)
          `,
          backgroundSize: "64px 64px",
          color: "var(--text-primary)",
          maskImage: "radial-gradient(ellipse at 50% 30%, black 40%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(ellipse at 50% 30%, black 40%, transparent 80%)",
        }}
      />
    </div>
  );
}

function Nav() {
  return (
    <header className="relative z-20 px-8 pt-8">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <div className="flex items-center gap-3">
          <Logo size="lg" />
          <span
            className="hidden font-mono text-[10px] uppercase tracking-[0.15em] text-gray sm:inline"
          >
            v0.1 · beta
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden rounded-[10px] px-4 py-2.5 text-[13px] font-semibold text-gray-light transition-colors hover:text-white sm:inline-block"
            style={{ letterSpacing: "-0.02em" }}
          >
            Autentificare
          </Link>
          <Link
            href="/login"
            className="group relative inline-flex items-center gap-2 rounded-[10px] border border-white/10 bg-white/[0.03] px-4 py-2.5 text-[13px] font-semibold text-white backdrop-blur-sm transition-all hover:border-primary/40 hover:bg-primary/10"
            style={{ letterSpacing: "-0.02em" }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-primary-light shadow-[0_0_8px_rgba(52,211,160,0.8)]" />
            Intra in cont
          </Link>
        </div>
      </div>
    </header>
  );
}

function HeroArtifact() {
  return (
    <div className="relative w-full max-w-md">
      {/* Glow behind card */}
      <div
        className="absolute inset-0 -z-10 rounded-3xl opacity-60 blur-2xl"
        style={{ background: "radial-gradient(ellipse at center, rgba(13,107,94,0.4), transparent 70%)" }}
      />

      {/* Card */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[rgba(17,31,30,0.6)] backdrop-blur-xl shadow-[0_40px_100px_-20px_rgba(0,0,0,0.5)]">
        {/* Top accent line */}
        <div className="h-px bg-gradient-to-r from-transparent via-primary-light/60 to-transparent" />

        <div className="p-8">
          {/* Header row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary-light" />
              <span
                className="font-mono text-[10px] uppercase tracking-[0.15em]"
                style={{ color: "rgba(212,208,196,0.9)" }}
              >
                Sincronizat · acum
              </span>
            </div>
            <span
              className="font-mono text-[10px] uppercase tracking-[0.15em]"
              style={{ color: "rgba(212,208,196,0.9)" }}
            >
              Dec 2025
            </span>
          </div>

          {/* Main KPI */}
          <div className="mt-10">
            <div
              className="font-mono text-[11px] uppercase tracking-[0.15em]"
              style={{ color: "rgba(212,208,196,0.9)" }}
            >
              Rezultat net
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span
                className="font-mono text-[56px] font-bold leading-none text-white tabular-nums"
                style={{ letterSpacing: "-0.04em" }}
              >
                247,318
              </span>
              <span
                className="font-mono text-[18px]"
                style={{ color: "rgba(212,208,196,0.9)" }}
              >
                RON
              </span>
            </div>
            <div className="mt-3 flex items-center gap-2 font-mono text-[11px] text-primary-light">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 7L5 3L8 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              +18.4% fata de luna trecuta
            </div>
          </div>

          {/* Divider */}
          <div className="my-8 h-px w-full bg-white/[0.06]" />

          {/* Mini stats row */}
          <div className="grid grid-cols-3 gap-6">
            {[
              { label: "Venituri", value: "1.2M" },
              { label: "Cheltuieli", value: "953K" },
              { label: "Marja", value: "18.4%" },
            ].map((stat) => (
              <div key={stat.label}>
                <div
                  className="font-mono text-[9px] uppercase tracking-[0.15em]"
                  style={{ color: "rgba(212,208,196,0.9)" }}
                >
                  {stat.label}
                </div>
                <div
                  className="mt-1.5 font-mono text-[18px] font-semibold text-white tabular-nums"
                  style={{ letterSpacing: "-0.03em" }}
                >
                  {stat.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom sparkline */}
        <div className="relative h-20 border-t border-white/[0.06] px-8 pb-4 pt-3">
          <div className="absolute bottom-4 left-8 right-8 flex h-12 items-end gap-1">
            {[30, 42, 38, 55, 48, 62, 58, 70, 65, 78, 72, 85, 80, 92, 88].map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t-sm bg-gradient-to-t from-primary/20 to-primary-light/60"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Floating tag */}
      <div
        className="absolute -right-4 top-8 rotate-3 overflow-hidden rounded-lg border border-white/[0.08] bg-[rgba(17,31,30,0.6)] backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
      >
        <div className="h-px bg-gradient-to-r from-transparent via-primary-light/60 to-transparent" />
        <div className="flex items-center gap-2 px-3.5 py-2.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34D3A0" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-primary-light">
            Balanta verificata
          </span>
        </div>
      </div>
    </div>
  );
}

function StatusFooter() {
  return (
    <footer className="relative z-10 border-t border-white/[0.06] px-8 py-6">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 font-mono text-[11px] uppercase tracking-[0.1em] text-gray">
        <div className="flex items-center gap-6">
          <span>&copy; 2026 Costify</span>
          <span className="hidden sm:inline">Nisindo · Romania</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green shadow-[0_0_8px_rgba(63,185,80,0.8)]" />
          Sistemele functioneaza
        </div>
      </div>
    </footer>
  );
}

export function LandingPage() {
  return (
    <div className="relative h-screen min-h-[700px] overflow-hidden bg-dark">
      <GridBackdrop />

      <div className="relative z-10 flex h-full flex-col">
        <Nav />

        <main className="relative flex flex-1 items-center px-8 py-8">
          <div className="mx-auto grid w-full max-w-7xl items-center gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
            {/* Left column: text */}
            <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
              <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.18em] text-gray">
                <span className="h-px w-8 bg-gradient-to-r from-transparent to-primary/40" />
                Control financiar pentru contabili
              </div>

              <h1
                className="mt-8 font-bold text-white"
                style={{
                  fontSize: "clamp(2.5rem, 6vw, 5.5rem)",
                  lineHeight: "0.95",
                  letterSpacing: "-0.05em",
                }}
              >
                Vezi unde se duce<br />
                <span className="text-white/40">fiecare </span>
                <span className="italic text-primary-light" style={{ fontFamily: "var(--font-mono)" }}>leu</span>
                <span className="text-white">.</span>
              </h1>

              <p
                className="mt-8 max-w-xl text-[16px] leading-[1.65] text-gray-light"
                style={{ letterSpacing: "-0.015em" }}
              >
                Import jurnal Saga, balanta de verificare si cont de profit si pierdere — calculate in timp real. Costi, asistentul AI, stie contabilitatea romaneasca pe dinafara.
              </p>

              <div className="mt-10 flex flex-wrap items-center gap-4">
                <Link
                  href="/login"
                  className="group inline-flex items-center gap-2.5 rounded-[12px] bg-primary px-7 py-4 text-[14px] font-semibold text-[#E9E8E3] shadow-[0_8px_32px_rgba(13,107,94,0.35)] transition-all hover:bg-primary-dark hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgba(13,107,94,0.5)]"
                  style={{ letterSpacing: "-0.02em" }}
                >
                  Intra in platforma
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="transition-transform group-hover:translate-x-0.5">
                    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>

                <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-gray">
                  <span className="h-1 w-1 rounded-full bg-gray" />
                  Invitatie necesara
                </div>
              </div>
            </div>

            {/* Right column: KPI artifact */}
            <div className="flex justify-center lg:justify-end">
              <HeroArtifact />
            </div>
          </div>
        </main>

        <StatusFooter />
      </div>
    </div>
  );
}

import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/modules/auth/session";
import { ArrowLeft, Eye, LayoutDashboard, Send, UserCheck, Layers, AlertCircle, Building2 } from "lucide-react";
import { isInternalUser } from "@/lib/internal-access";
import { resolveShowcaseClient } from "./_data/snapshot";

type Status = "ready" | "wip" | "todo";

interface Screen {
  href: string;
  label: string;
  desc: string;
  icon: typeof Eye;
  status: Status;
}

const SCREENS: Screen[] = [
  {
    href: "/internal/firma/pagina",
    label: "Pagina firmei",
    desc: "Ce vede antreprenorul cand intra in Costify. KPI-uri, cash position, evolutie, insights.",
    icon: Building2,
    status: "ready",
  },
  {
    href: "/internal/firma/panou",
    label: "Panou contabil",
    desc: "Tab nou la nivel de client. Status import, KPI-uri in limba contabila, conturi nemapate, insights.",
    icon: LayoutDashboard,
    status: "todo",
  },
  {
    href: "/internal/firma/preview",
    label: "Preview contabil",
    desc: "Contabilul vede ce vede clientul lui. Banner sus, identic cu Pagina firmei.",
    icon: Eye,
    status: "ready",
  },
  {
    href: "/internal/firma/invitatie",
    label: "Trimite invitatie",
    desc: "Sectiunea Acces clientului din tab Setari. Email + lista invitati + revocare.",
    icon: Send,
    status: "todo",
  },
  {
    href: "/internal/firma/acceptare",
    label: "Acceptare invitatie",
    desc: "Landing /accept/:token. Formular cont nou sau login existent.",
    icon: UserCheck,
    status: "todo",
  },
  {
    href: "/internal/firma/selector",
    label: "Selector firme",
    desc: "Dropdown navbar pentru antreprenori cu mai multe SRL-uri.",
    icon: Layers,
    status: "todo",
  },
  {
    href: "/internal/firma/stari",
    label: "Stari speciale",
    desc: "Empty (firma fara date), loading, error, primul login antreprenor.",
    icon: AlertCircle,
    status: "todo",
  },
];

const STATUS_CONFIG: Record<Status, { label: string; className: string }> = {
  ready: {
    label: "Gata",
    className: "bg-green/[0.12] text-green border-green/30",
  },
  wip: {
    label: "In lucru",
    className: "bg-warn/[0.12] text-warn border-warn/30",
  },
  todo: {
    label: "De facut",
    className: "bg-dark-3 text-gray border-dark-3",
  },
};

export default async function FirmaShowcaseHub() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!isInternalUser(user.email)) redirect("/clients");

  const showcase = await resolveShowcaseClient();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
      <Link
        href="/internal"
        className="mb-6 inline-flex items-center gap-1.5 text-[13px] text-gray-light hover:text-white transition-colors"
      >
        <ArrowLeft size={14} /> Internal
      </Link>

      <div className="mb-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-primary" style={{ letterSpacing: "0.05em" }}>
          Specs vizuale
        </span>
      </div>
      <h1 className="text-[32px] font-semibold text-white" style={{ letterSpacing: "-0.04em" }}>
        Vederea antreprenorului
      </h1>
      <p className="mt-2 text-[14px] text-gray-light max-w-2xl" style={{ letterSpacing: "-0.02em" }}>
        Cum arata Costify pentru un antreprenor invitat de contabil.{" "}
        {showcase ? (
          <>
            Toate ecranele folosesc date reale ale firmei{" "}
            <span className="font-mono text-white">{showcase.name}</span>
            {showcase.cui ? <> ({showcase.cui})</> : null} la{" "}
            <span className="font-mono text-white">{showcase.periodLabel}</span>.
          </>
        ) : (
          <span className="text-warn">
            Configureaza <code className="font-mono text-white">SHOWCASE_CLIENT_SLUG</code> in
            .env pentru a activa ecranele cu date reale.
          </span>
        )}
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {SCREENS.map((screen) => {
          const Icon = screen.icon;
          const status = STATUS_CONFIG[screen.status];
          const isReady = screen.status === "ready";
          const content = (
            <>
              <div className="flex items-start justify-between mb-3">
                <Icon size={22} className={`${isReady ? "text-primary" : "text-gray"} transition-colors`} />
                <span
                  className={`rounded-md border px-2 py-0.5 font-mono text-[10px] font-medium uppercase ${status.className}`}
                  style={{ letterSpacing: "0.05em" }}
                >
                  {status.label}
                </span>
              </div>
              <p
                className={`text-[15px] font-semibold ${isReady ? "text-white" : "text-gray-light"}`}
                style={{ letterSpacing: "-0.04em" }}
              >
                {screen.label}
              </p>
              <p className="mt-1 text-[13px] text-gray leading-relaxed" style={{ letterSpacing: "-0.02em" }}>
                {screen.desc}
              </p>
            </>
          );
          const baseClass =
            "block rounded-xl border border-dark-3 bg-dark-2 p-5 transition-all";
          if (isReady) {
            return (
              <Link
                key={screen.href}
                href={screen.href}
                className={`${baseClass} hover:border-primary/30 hover:-translate-y-0.5 cursor-pointer`}
              >
                {content}
              </Link>
            );
          }
          return (
            <div key={screen.href} className={`${baseClass} opacity-60 cursor-not-allowed`}>
              {content}
            </div>
          );
        })}
      </div>

      <div className="mt-12 rounded-xl border border-dark-3 bg-dark-2 p-5">
        <p className="font-mono text-[10px] uppercase tracking-wider text-gray mb-2" style={{ letterSpacing: "0.05em" }}>
          Context
        </p>
        <p className="text-[13px] text-gray-light leading-relaxed" style={{ letterSpacing: "-0.02em" }}>
          Aceste ecrane sunt construite din componente refolosibile (vezi{" "}
          <code className="font-mono text-white text-[12px]">src/app/(dashboard)/internal/firma/_components/</code>
          ) si date reale incarcate via{" "}
          <code className="font-mono text-white text-[12px]">loadFirmaSnapshot()</code>.
          La PR-D vor fi mutate in productie sub <code className="font-mono text-white text-[12px]">src/components/clients/owner/</code>{" "}
          fara rescriere — doar sursa de date se schimba din inghetat in dinamic.
        </p>
        <p className="mt-3 text-[13px] text-gray-light leading-relaxed" style={{ letterSpacing: "-0.02em" }}>
          Decizii arhitecturale:{" "}
          <Link href="/docs" className="text-primary hover:underline">
            ADR-0003 Cashflow control antreprenor
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

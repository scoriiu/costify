"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Plus, Building2, Database, CheckCircle2, AlertTriangle, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { ToggleGroup } from "@/components/ui/toggle-group";
import { CreateClientDialog } from "./create-client-dialog";

interface ClientItem {
  id: string;
  slug: string;
  name: string;
  cui: string | null;
  caen: string | null;
  entryCount: number;
  createdAt: string;
  updatedAt: string;
  verticalsEnabled: boolean;
  latestPublished: {
    year: number;
    month: number;
    publishedAt: string;
    isStale: boolean;
  } | null;
}

type SortBy = "recent" | "name" | "active";

interface ClientListProps {
  clients: ClientItem[];
}

export function ClientList({ clients }: ClientListProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortBy>("recent");

  const filteredAndSorted = useMemo(() => {
    const trimmed = query.trim();
    const needle = stripDiacritics(trimmed.toLowerCase());

    const filtered = trimmed
      ? clients.filter((c) => {
          const hay = stripDiacritics(
            `${c.name} ${c.cui ?? ""} ${c.caen ?? ""}`.toLowerCase()
          );
          return hay.includes(needle);
        })
      : clients;

    const sorted = [...filtered];
    if (sort === "name") {
      sorted.sort((a, b) => a.name.localeCompare(b.name, "ro"));
    } else if (sort === "active") {
      sorted.sort((a, b) => b.entryCount - a.entryCount);
    } else {
      sorted.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    }
    return sorted;
  }, [clients, query, sort]);

  const totalEntries = clients.reduce((s, c) => s + c.entryCount, 0);
  const publishedCount = clients.filter((c) => c.latestPublished !== null).length;
  const staleCount = clients.filter((c) => c.latestPublished?.isStale).length;

  if (clients.length === 0) {
    return <EmptyState onAdd={() => setShowCreate(true)} showCreate={showCreate} closeCreate={() => setShowCreate(false)} />;
  }

  return (
    <div>
      <header className="mb-6">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
          <div>
            <h1
              className="text-[28px] font-semibold text-white leading-tight"
              style={{ letterSpacing: "-0.04em" }}
            >
              Clientii tai
            </h1>
            <p
              className="text-[13px] text-gray mt-1"
              style={{ letterSpacing: "-0.02em" }}
            >
              {clients.length === 1
                ? "1 firma in portofoliu"
                : `${clients.length} firme in portofoliu`}
              {" · "}
              {totalEntries.toLocaleString("ro-RO")} intrari in jurnal in total
            </p>
          </div>
          <Button onClick={() => setShowCreate(true)}>
            <Plus size={16} /> Adauga client
          </Button>
        </div>

        {/* Portfolio overview KPIs — calm, informative, no rainbow */}
        <div className="grid gap-3 sm:grid-cols-3 mb-5">
          <KpiCard
            icon={<Building2 size={14} />}
            label="Firme"
            value={clients.length.toString()}
            hint={`${publishedCount} cu raport publicat`}
          />
          <KpiCard
            icon={<Database size={14} />}
            label="Intrari jurnal"
            value={formatCount(totalEntries)}
            hint="Toate firmele cumulate"
          />
          <KpiCard
            icon={<AlertTriangle size={14} />}
            label="Rapoarte invechite"
            value={staleCount.toString()}
            hint={
              staleCount === 0
                ? "Toate publicarile sunt la zi"
                : "Rulajul s-a schimbat dupa publicare"
            }
            tone={staleCount > 0 ? "danger" : undefined}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Cauta dupa nume, CUI sau cod CAEN..."
            className="flex-1 min-w-[260px] max-w-md"
          />
          <ToggleGroup<SortBy>
            value={sort}
            onChange={setSort}
            options={[
              { value: "recent", label: "Recente" },
              { value: "name", label: "A-Z" },
              { value: "active", label: "Cele mai active" },
            ]}
          />
        </div>

        {query.trim() !== "" && (
          <p
            className="text-[11px] text-gray mt-3"
            style={{ letterSpacing: "-0.02em" }}
          >
            {filteredAndSorted.length === 0
              ? "Nicio firma nu se potriveste cautarii."
              : `${filteredAndSorted.length} din ${clients.length} firme afisate.`}
          </p>
        )}
      </header>

      {filteredAndSorted.length === 0 ? (
        <p
          className="text-[13px] text-gray italic py-8 text-center"
          style={{ letterSpacing: "-0.02em" }}
        >
          Niciun rezultat. Incearca alt termen sau{" "}
          <button
            type="button"
            onClick={() => setQuery("")}
            className="text-primary hover:text-primary-light underline underline-offset-2"
          >
            sterge cautarea
          </button>
          .
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredAndSorted.map((client) => (
            <ClientCard key={client.id} client={client} />
          ))}
        </ul>
      )}

      {showCreate && <CreateClientDialog onClose={() => setShowCreate(false)} />}
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  tone?: "danger";
}) {
  return (
    <div className="rounded-lg border border-dark-3 bg-dark-2/60 px-4 py-3">
      <div
        className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-gray"
        style={{ letterSpacing: "-0.02em" }}
      >
        <span className={tone === "danger" ? "text-neg" : ""}>
          {icon}
        </span>
        {label}
      </div>
      <div
        className={`font-mono text-[22px] font-bold tabular-nums mt-1 ${
          tone === "danger" && value !== "0" ? "text-neg" : "text-white"
        }`}
        style={{ letterSpacing: "-0.04em" }}
      >
        {value}
      </div>
      <div
        className="text-[11px] text-gray mt-0.5"
        style={{ letterSpacing: "-0.02em" }}
      >
        {hint}
      </div>
    </div>
  );
}

function ClientCard({ client }: { client: ClientItem }) {
  return (
    <li>
      <Link
        href={`/clients/${client.slug}`}
        prefetch={false}
        className="group block rounded-xl border border-dark-3 bg-dark-2 p-5 transition-all hover:border-primary/40 hover:-translate-y-0.5"
      >
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
            <Building2 size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <h3
              className="truncate text-[15px] font-semibold text-white"
              style={{ letterSpacing: "-0.04em" }}
              title={client.name}
            >
              {client.name}
            </h3>
            <div
              className="font-mono text-[11px] text-gray flex items-center gap-2 mt-0.5"
              style={{ letterSpacing: "-0.02em" }}
            >
              {client.cui && <span>CUI {client.cui}</span>}
              {client.cui && client.caen && (
                <span className="text-dark-3" aria-hidden>·</span>
              )}
              {client.caen && <span>CAEN {client.caen}</span>}
              {!client.cui && !client.caen && (
                <span className="italic">Fara CUI/CAEN setate</span>
              )}
            </div>
          </div>
        </div>

        <div
          className="flex items-center gap-2 font-mono text-[11px] text-gray mb-2"
          style={{ letterSpacing: "-0.02em" }}
        >
          <Database size={11} />
          <span className="tabular-nums">
            {client.entryCount.toLocaleString("ro-RO")} intrari
          </span>
          {client.verticalsEnabled && (
            <>
              <span className="text-dark-3" aria-hidden>·</span>
              <Layers size={11} />
              <span>cu verticale</span>
            </>
          )}
        </div>

        <div className="border-t border-dark-3/60 pt-2 mt-2">
          {client.latestPublished ? (
            <PublishedBadge published={client.latestPublished} />
          ) : (
            <span
              className="font-mono text-[10px] uppercase tracking-wider text-gray italic"
              style={{ letterSpacing: "-0.02em" }}
            >
              Niciun raport publicat inca
            </span>
          )}
        </div>
      </Link>
    </li>
  );
}

function PublishedBadge({
  published,
}: {
  published: NonNullable<ClientItem["latestPublished"]>;
}) {
  const period = `${MONTHS[published.month - 1]} ${published.year}`;
  if (published.isStale) {
    return (
      <div
        className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-tone-warn"
        style={{ letterSpacing: "-0.02em" }}
      >
        <AlertTriangle size={11} />
        Publicat {period} (invechit)
      </div>
    );
  }
  return (
    <div
      className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-gray-light"
      style={{ letterSpacing: "-0.02em" }}
    >
      <CheckCircle2 size={11} />
      Publicat {period}
    </div>
  );
}

function EmptyState({
  onAdd,
  showCreate,
  closeCreate,
}: {
  onAdd: () => void;
  showCreate: boolean;
  closeCreate: () => void;
}) {
  return (
    <div>
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-dark-3 py-20">
        <Building2 size={48} className="mb-4 text-gray/40" />
        <h3
          className="mb-1 text-[18px] font-semibold text-white"
          style={{ letterSpacing: "-0.04em" }}
        >
          Niciun client inca
        </h3>
        <p
          className="mb-5 text-[13px] text-gray max-w-md text-center"
          style={{ letterSpacing: "-0.02em" }}
        >
          Adauga prima firma din portofoliul tau ca sa incepi sa importi jurnale
          si sa publici rapoarte pentru antreprenori.
        </p>
        <Button onClick={onAdd}>
          <Plus size={16} /> Adauga prima firma
        </Button>
      </div>
      {showCreate && <CreateClientDialog onClose={closeCreate} />}
    </div>
  );
}

const MONTHS = [
  "ianuarie",
  "februarie",
  "martie",
  "aprilie",
  "mai",
  "iunie",
  "iulie",
  "august",
  "septembrie",
  "octombrie",
  "noiembrie",
  "decembrie",
];

function formatCount(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 10000) return `${Math.round(n / 1000)}k`;
  return n.toLocaleString("ro-RO");
}

function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

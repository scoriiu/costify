"use client";

/**
 * "Mapari Cashflow" tab — accountant-only screen on /clients/[slug].
 *
 * Linear, numbered three-step flow, top to bottom:
 *
 *   1. Categorii — how to group costs/revenues (axa A, generic OMFP defaults).
 *   2. Verticale — optional, only if firm has multiple business lines (axa B).
 *   3. Conturi — actual mapping of each chart-of-accounts entry to (1) and (2).
 *
 * The three sections live on the same page so the accountant does not need to
 * context-switch between Setari and Mapari to configure cashflow. Every non-
 * obvious affordance has a Tooltip explaining what it does and giving examples.
 *
 * All mutations go through server actions and the page revalidates afterwards.
 * No client-side optimistic state — eliminates "saved but UI lies" bugs.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Check, AlertTriangle, Sparkles, Info, Layers, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ToggleGroup } from "@/components/ui/toggle-group";
import { Tooltip } from "@/components/ui/tooltip";
import type {
  CostCategoryNode,
  MappingScope,
  AccountListItem,
  MapariCashflowData,
} from "@/modules/categories";
import {
  createCategoryAction,
  renameCategoryAction,
  deleteCategoryAction,
  mapAccountAction,
  unmapAccountAction,
} from "@/modules/categories/actions";
import {
  enableVerticalsAction,
  disableVerticalsAction,
  createVerticalAction,
  renameVerticalAction,
  deleteVerticalAction,
} from "@/modules/verticals/actions";
import { flattenTreeForPicker, pickerLabel, type FlatNode } from "./tree-utils";
import { VerticalPicker } from "./vertical-picker";
import type { VerticalView } from "@/modules/verticals";

interface Props {
  data: MapariCashflowData;
}

type Filter = "all" | "unmapped" | "expense" | "revenue";

export function MapariCashflowTab({ data }: Props) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const onMutate = () => router.refresh();

  const filteredAccounts = data.accounts.filter((a) => {
    if (filter === "expense") return a.kind === "expense";
    if (filter === "revenue") return a.kind === "revenue";
    if (filter === "unmapped") return a.currentMapping === null;
    return true;
  });

  const unmappedCount = data.accounts.filter((a) => a.currentMapping === null).length;

  return (
    <div className="space-y-8 max-w-6xl">
      <PageHeader period={data.period} freshlySeeded={data.freshlySeeded} />

      <StepSection
        number={1}
        title="Categorii"
        helper="Cum vrei sa numesti grupurile de cheltuieli si venituri ale firmei. Acestea apar pe /firma sub 'Unde s-au dus banii' si 'De unde au venit banii'. Am pornit cu o lista OMFP standard — redenumeste sau adauga ce vrei."
      >
        <CategoryTreePanel
          tree={data.tree}
          clientId={data.clientId}
          onMutate={onMutate}
        />
      </StepSection>

      <StepSection
        number={2}
        title="Verticale de business"
        optional
        helper={
          data.verticalsEnabled
            ? "Linii de business pe care le urmaresti separat. Conturile fara verticala alocata merg la 'Toata firma'."
            : "Activeaza doar daca firma are mai multe linii de business (exemplu QHM21: Outsourcing, Recruitment, Coworking). Pentru majoritatea firmelor nu e necesar."
        }
      >
        <VerticalsPanel
          clientId={data.clientId}
          enabled={data.verticalsEnabled}
          verticals={data.verticals}
          onMutate={onMutate}
        />
      </StepSection>

      <StepSection
        number={3}
        title="Mapeaza conturile"
        helper={
          data.verticalsEnabled
            ? "Conturile firmei din ultima luna inregistrata. Aloca fiecare la o categorie si optional la o verticala. Sumele sunt rulajul lunii — reper rapid sa vezi ce conturi conteaza."
            : "Conturile firmei din ultima luna inregistrata. Aloca fiecare la o categorie. Sumele sunt rulajul lunii — reper rapid sa vezi ce conturi conteaza."
        }
      >
        <AccountListPanel
          accounts={filteredAccounts}
          totalAccounts={data.accounts.length}
          unmappedCount={unmappedCount}
          filter={filter}
          onFilterChange={setFilter}
          tree={data.tree}
          clientId={data.clientId}
          verticalsEnabled={data.verticalsEnabled}
          verticals={data.verticals}
          onMutate={onMutate}
        />
      </StepSection>
    </div>
  );
}

function StepSection({
  number,
  title,
  helper,
  optional,
  children,
}: {
  number: number;
  title: string;
  helper: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3">
        <div className="flex items-baseline gap-3">
          <span
            className="font-mono text-[11px] uppercase tracking-wider text-primary"
            aria-hidden
          >
            Pasul {number}
          </span>
          <h3
            className="text-[18px] font-semibold text-white"
            style={{ letterSpacing: "-0.04em" }}
          >
            {title}
          </h3>
          {optional && (
            <span
              className="font-mono text-[10px] uppercase tracking-wider text-gray"
              aria-hidden
            >
              optional
            </span>
          )}
        </div>
        <p
          className="mt-1 text-[12px] text-gray max-w-3xl"
          style={{ letterSpacing: "-0.02em" }}
        >
          {helper}
        </p>
      </div>
      {children}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*                          VERTICALS PANEL (PASUL 2)                         */
/* -------------------------------------------------------------------------- */

function VerticalsPanel({
  clientId,
  enabled,
  verticals,
  onMutate,
}: {
  clientId: string;
  enabled: boolean;
  verticals: VerticalView[];
  onMutate: () => void;
}) {
  if (!enabled) {
    return <VerticalsOff clientId={clientId} onMutate={onMutate} />;
  }
  return <VerticalsOn clientId={clientId} verticals={verticals} onMutate={onMutate} />;
}

function VerticalsOff({
  clientId,
  onMutate,
}: {
  clientId: string;
  onMutate: () => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  return (
    <>
      <div className="rounded-xl border border-dark-3 bg-dark-2 p-5">
        <div className="flex items-start gap-3">
          <Layers size={16} className="text-gray mt-1 shrink-0" />
          <div className="flex-1">
            <p
              className="text-[13px] text-gray-light max-w-2xl"
              style={{ letterSpacing: "-0.02em" }}
            >
              Daca firma are mai multe linii distincte (Outsourcing, Recruitment,
              Coworking, sau proiecte separate), poti vedea cat aduce si
              cheltuieste fiecare. Datele existente raman neatinse — activezi si
              dezactivezi oricand.
            </p>
            <div className="mt-3">
              <Button variant="primary" onClick={() => setModalOpen(true)}>
                Activeaza verticale
              </Button>
            </div>
          </div>
        </div>
      </div>
      {modalOpen && (
        <ActivateVerticalsModal
          clientId={clientId}
          onClose={() => setModalOpen(false)}
          onDone={() => {
            setModalOpen(false);
            onMutate();
          }}
        />
      )}
    </>
  );
}

function VerticalsOn({
  clientId,
  verticals,
  onMutate,
}: {
  clientId: string;
  verticals: VerticalView[];
  onMutate: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();

  function deactivate() {
    if (
      !confirm(
        "Dezactivez verticalele? Datele se pastreaza si pot fi reactivate oricand."
      )
    )
      return;
    startTransition(async () => {
      await disableVerticalsAction({ clientId });
      onMutate();
    });
  }

  return (
    <div className="rounded-xl border border-dark-3 bg-dark-2 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Layers size={14} className="text-primary" />
          <span
            className="text-[13px] text-gray-light"
            style={{ letterSpacing: "-0.02em" }}
          >
            {verticals.length} verticale active
          </span>
        </div>
        <Tooltip content="Ascunde verticalele peste tot. Datele se pastreaza si pot fi reactivate oricand.">
          <button
            type="button"
            onClick={deactivate}
            disabled={pending}
            className="text-[11px] text-gray hover:text-gray-light"
            style={{ letterSpacing: "-0.02em" }}
          >
            Dezactiveaza
          </button>
        </Tooltip>
      </div>

      <ul className="space-y-1">
        {verticals.map((v) => (
          <VerticalRow key={v.id} vertical={v} clientId={clientId} onMutate={onMutate} />
        ))}
      </ul>

      {adding ? (
        <AddVerticalInline
          clientId={clientId}
          onDone={() => {
            setAdding(false);
            onMutate();
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <Tooltip content="Adauga o noua linie de business (exemplu: 'Consultanta strategica' separat de 'Outsourcing tehnic').">
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mt-3 inline-flex items-center gap-1.5 text-[12px] text-primary hover:text-primary-light"
            style={{ letterSpacing: "-0.02em" }}
          >
            <Plus size={12} /> Adauga verticala
          </button>
        </Tooltip>
      )}
    </div>
  );
}

function VerticalRow({
  vertical,
  clientId,
  onMutate,
}: {
  vertical: VerticalView;
  clientId: string;
  onMutate: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [pending, startTransition] = useTransition();

  function remove() {
    if (
      !confirm(
        `Sterg verticala "${vertical.name}"? Conturile alocate aici trec automat la "Toata firma".`
      )
    )
      return;
    startTransition(async () => {
      const r = await deleteVerticalAction({ clientId, verticalId: vertical.id });
      if (r.error) alert(r.error);
      else onMutate();
    });
  }

  if (renaming) {
    return (
      <li>
        <RenameVerticalInline
          vertical={vertical}
          clientId={clientId}
          onDone={() => {
            setRenaming(false);
            onMutate();
          }}
          onCancel={() => setRenaming(false)}
        />
      </li>
    );
  }

  return (
    <li className="group flex items-center gap-3 py-1.5 px-2 rounded-md hover:bg-dark-3/50">
      <span
        className="flex-1 text-[13px] text-gray-light"
        style={{ letterSpacing: "-0.02em" }}
      >
        {vertical.name}
        {vertical.isDefault && (
          <Tooltip content="Verticala implicita unde merg conturile fara alocare. Nu poti sterge, doar redenumi.">
            <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-gray cursor-help">
              implicit
            </span>
          </Tooltip>
        )}
      </span>
      <span className="font-mono text-[11px] text-gray tabular-nums shrink-0">
        {vertical.allocationCount} conturi
      </span>
      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1">
        <Tooltip content="Redenumeste">
          <button
            type="button"
            onClick={() => setRenaming(true)}
            className="p-1 text-gray hover:text-primary"
          >
            <Pencil size={11} />
          </button>
        </Tooltip>
        {!vertical.isDefault && (
          <Tooltip content="Sterge verticala. Conturile alocate aici trec la 'Toata firma'.">
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              className="p-1 text-gray hover:text-rose-300"
            >
              <Trash2 size={11} />
            </button>
          </Tooltip>
        )}
      </div>
    </li>
  );
}

function RenameVerticalInline({
  vertical,
  clientId,
  onDone,
  onCancel,
}: {
  vertical: VerticalView;
  clientId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(vertical.name);
  const [pending, startTransition] = useTransition();

  function submit() {
    const trimmed = name.trim();
    if (trimmed.length === 0 || trimmed === vertical.name) {
      onCancel();
      return;
    }
    startTransition(async () => {
      const r = await renameVerticalAction({
        clientId,
        verticalId: vertical.id,
        name: trimmed,
      });
      if (r.error) {
        alert(r.error);
        onCancel();
      } else {
        onDone();
      }
    });
  }

  return (
    <div className="flex items-center gap-2 py-1.5 px-2">
      <Input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") onCancel();
        }}
      />
      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="p-1 text-primary hover:text-primary-light"
      >
        <Check size={14} />
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="p-1 text-gray hover:text-gray-light"
      >
        <X size={14} />
      </button>
    </div>
  );
}

function AddVerticalInline({
  clientId,
  onDone,
  onCancel,
}: {
  clientId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    const trimmed = name.trim();
    if (trimmed.length === 0) return;
    setError(null);
    startTransition(async () => {
      const r = await createVerticalAction({ clientId, name: trimmed });
      if (r.error) setError(r.error);
      else onDone();
    });
  }

  return (
    <div className="mt-3 flex items-center gap-2">
      <Input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nume verticala"
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") onCancel();
        }}
      />
      <Button variant="primary" onClick={submit} disabled={pending || !name.trim()}>
        Adauga
      </Button>
      <Button variant="ghost" onClick={onCancel}>
        Renunta
      </Button>
      {error && <p className="text-[11px] text-rose-300">{error}</p>}
    </div>
  );
}

function ActivateVerticalsModal({
  clientId,
  onClose,
  onDone,
}: {
  clientId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [names, setNames] = useState<string[]>(["", "", ""]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function updateName(idx: number, value: string) {
    setNames((prev) => prev.map((n, i) => (i === idx ? value : n)));
  }
  function addRow() {
    setNames((prev) => [...prev, ""]);
  }
  function removeRow(idx: number) {
    setNames((prev) => prev.filter((_, i) => i !== idx));
  }

  function submit() {
    setError(null);
    const cleaned = names.map((n) => n.trim()).filter((n) => n.length > 0);
    if (cleaned.length === 0) {
      setError("Adauga cel putin o verticala (exemplu: 'Outsourcing').");
      return;
    }
    startTransition(async () => {
      const enableResult = await enableVerticalsAction({ clientId });
      if (enableResult.error) {
        setError(enableResult.error);
        return;
      }
      for (const name of cleaned) {
        const r = await createVerticalAction({ clientId, name });
        if (r.error) {
          setError(`Eroare la "${name}": ${r.error}`);
          return;
        }
      }
      onDone();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-dark-3 bg-dark-2 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          className="text-[18px] font-semibold text-white"
          style={{ letterSpacing: "-0.04em" }}
        >
          Configureaza verticalele firmei
        </h2>
        <p
          className="mt-2 text-[13px] text-gray-light"
          style={{ letterSpacing: "-0.02em" }}
        >
          Scrie numele liniilor de business pe care vrei sa le urmaresti. Poti
          adauga sau modifica oricand.
        </p>
        <ul className="mt-5 space-y-2">
          {names.map((name, idx) => (
            <li key={idx} className="flex items-center gap-2">
              <span className="font-mono text-[11px] text-gray w-5 shrink-0 tabular-nums">
                {idx + 1}.
              </span>
              <Input
                value={name}
                onChange={(e) => updateName(idx, e.target.value)}
                placeholder={
                  idx === 0 ? "Outsourcing" : idx === 1 ? "Recruitment" : idx === 2 ? "Coworking" : "Alt nume"
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                }}
              />
              {names.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeRow(idx)}
                  className="p-1 text-gray hover:text-rose-300"
                  title="Sterge"
                >
                  <X size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={addRow}
          className="mt-3 inline-flex items-center gap-1.5 text-[12px] text-primary hover:text-primary-light"
          style={{ letterSpacing: "-0.02em" }}
        >
          <Plus size={12} /> Adauga inca una
        </button>
        <p
          className="mt-5 text-[11px] text-gray italic"
          style={{ letterSpacing: "-0.02em" }}
        >
          Verticala &quot;Toata firma&quot; se creeaza automat ca fallback pentru
          conturi nealocate.
        </p>
        {error && <p className="mt-3 text-[12px] text-rose-300">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Renunta
          </Button>
          <Button variant="primary" onClick={submit} disabled={pending}>
            {pending ? "Se salveaza..." : "Salveaza si continua"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function PageHeader({
  period,
  freshlySeeded,
}: {
  period: { year: number; month: number } | null;
  freshlySeeded: boolean;
}) {
  return (
    <div className="space-y-3">
      <div>
        <h2
          className="text-[20px] font-semibold text-white"
          style={{ letterSpacing: "-0.04em" }}
        >
          Mapari Cashflow
        </h2>
        <p
          className="mt-1 max-w-3xl text-[13px] text-gray-light"
          style={{ letterSpacing: "-0.02em" }}
        >
          Organizeaza conturile firmei in categorii usor de inteles pentru
          antreprenor. Acestea apar pe /firma sub &quot;Unde s-au dus banii&quot;
          si &quot;De unde au venit banii&quot;. Sumele de mai jos sunt rulajul
          ultimei luni inregistrate
          {period
            ? ` (${monthLabel(period.year, period.month)})`
            : ""}{" "}
          — un reper rapid pentru ce conturi conteaza.
        </p>
      </div>

      {freshlySeeded && (
        <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
          <Sparkles size={14} className="text-primary mt-0.5 shrink-0" />
          <p
            className="text-[12px] text-gray-light"
            style={{ letterSpacing: "-0.02em" }}
          >
            Am pornit cu taxonomia standard OMFP. Editeaz&apos;o cum vrei —
            redenumeste, adauga subcategorii, sterge ce nu se aplica.
          </p>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                            LEFT — CATEGORY TREE                            */
/* -------------------------------------------------------------------------- */

function CategoryTreePanel({
  tree,
  clientId,
  onMutate,
}: {
  tree: CostCategoryNode[];
  clientId: string;
  onMutate: () => void;
}) {
  const expenseRoots = tree.filter((n) => n.kind === "expense");
  const revenueRoots = tree.filter((n) => n.kind === "revenue");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="rounded-xl border border-dark-3 bg-dark-2 p-5">
        <CategorySection
          title="Cheltuieli"
          subtitle="Iesirile firmei"
          kind="expense"
          roots={expenseRoots}
          clientId={clientId}
          onMutate={onMutate}
        />
      </div>
      <div className="rounded-xl border border-dark-3 bg-dark-2 p-5">
        <CategorySection
          title="Venituri"
          subtitle="Intrarile firmei"
          kind="revenue"
          roots={revenueRoots}
          clientId={clientId}
          onMutate={onMutate}
        />
      </div>
    </div>
  );
}

function CategorySection({
  title,
  subtitle,
  kind,
  roots,
  clientId,
  onMutate,
}: {
  title: string;
  subtitle: string;
  kind: "expense" | "revenue";
  roots: CostCategoryNode[];
  clientId: string;
  onMutate: () => void;
}) {
  const [addingAt, setAddingAt] = useState<string | "ROOT" | null>(null);

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h3
            className="text-[14px] font-semibold text-white"
            style={{ letterSpacing: "-0.04em" }}
          >
            {title}
          </h3>
          <p
            className="text-[11px] text-gray"
            style={{ letterSpacing: "-0.02em" }}
          >
            {subtitle}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAddingAt("ROOT")}
          className="inline-flex items-center gap-1 text-[11px] text-primary hover:text-primary-light"
          style={{ letterSpacing: "-0.02em" }}
        >
          <Plus size={12} /> Adauga
        </button>
      </div>

      {addingAt === "ROOT" && (
        <NewCategoryRow
          clientId={clientId}
          parentId={null}
          kind={kind}
          onDone={() => {
            setAddingAt(null);
            onMutate();
          }}
          onCancel={() => setAddingAt(null)}
        />
      )}

      {roots.length === 0 && addingAt !== "ROOT" && (
        <p className="text-[12px] text-gray italic">Nicio categorie inca.</p>
      )}

      <ul className="space-y-0.5">
        {roots.map((node) => (
          <CategoryTreeNode
            key={node.id}
            node={node}
            depth={0}
            clientId={clientId}
            addingAt={addingAt}
            setAddingAt={setAddingAt}
            onMutate={onMutate}
          />
        ))}
      </ul>
    </div>
  );
}

function CategoryTreeNode({
  node,
  depth,
  clientId,
  addingAt,
  setAddingAt,
  onMutate,
}: {
  node: CostCategoryNode;
  depth: number;
  clientId: string;
  addingAt: string | "ROOT" | null;
  setAddingAt: (v: string | "ROOT" | null) => void;
  onMutate: () => void;
}) {
  const [renaming, setRenaming] = useState(false);

  return (
    <li>
      <div
        className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-dark-3/50"
        style={{ paddingLeft: `${0.5 + depth * 1}rem` }}
      >
        {renaming ? (
          <RenameInline
            node={node}
            clientId={clientId}
            onDone={() => {
              setRenaming(false);
              onMutate();
            }}
            onCancel={() => setRenaming(false)}
          />
        ) : (
          <>
            <span
              className="flex-1 truncate text-[13px] text-gray-light"
              style={{ letterSpacing: "-0.02em" }}
              title={node.name}
            >
              {node.name}
            </span>
            {node.isOmfpDefault && (
              <Tooltip content="Categorie generata automat la prima vizita din planul de conturi standard OMFP. Poti redenumi sau sterge fara probleme.">
                <span className="font-mono text-[9px] uppercase tracking-wider text-gray shrink-0 cursor-help">
                  OMFP
                </span>
              </Tooltip>
            )}
            {node.mappingCount > 0 && (
              <Tooltip content={`${node.mappingCount} conturi mapate direct la aceasta categorie.`}>
                <span className="font-mono text-[10px] text-gray tabular-nums shrink-0 cursor-help">
                  {node.mappingCount}
                </span>
              </Tooltip>
            )}
            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1">
              <Tooltip content="Adauga sub-categorie. Va aparea indentata sub aceasta categorie pe /firma.">
                <button
                  type="button"
                  onClick={() => setAddingAt(node.id)}
                  className="p-1 text-gray hover:text-primary"
                >
                  <Plus size={11} />
                </button>
              </Tooltip>
              <Tooltip content="Redenumeste categoria.">
                <button
                  type="button"
                  onClick={() => setRenaming(true)}
                  className="p-1 text-gray hover:text-primary"
                >
                  <Pencil size={11} />
                </button>
              </Tooltip>
              <DeleteCategoryButton
                node={node}
                clientId={clientId}
                onDone={onMutate}
              />
            </div>
          </>
        )}
      </div>

      {addingAt === node.id && (
        <div style={{ paddingLeft: `${0.5 + (depth + 1) * 1}rem` }}>
          <NewCategoryRow
            clientId={clientId}
            parentId={node.id}
            kind={node.kind}
            onDone={() => {
              setAddingAt(null);
              onMutate();
            }}
            onCancel={() => setAddingAt(null)}
          />
        </div>
      )}

      {node.children.length > 0 && (
        <ul className="space-y-0.5">
          {node.children.map((child) => (
            <CategoryTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              clientId={clientId}
              addingAt={addingAt}
              setAddingAt={setAddingAt}
              onMutate={onMutate}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function NewCategoryRow({
  clientId,
  parentId,
  kind,
  onDone,
  onCancel,
}: {
  clientId: string;
  parentId: string | null;
  kind: "expense" | "revenue";
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    const trimmed = name.trim();
    if (trimmed.length === 0) return;
    setError(null);
    startTransition(async () => {
      const result = await createCategoryAction({
        clientId,
        parentId,
        kind,
        name: trimmed,
      });
      if (result.error) setError(result.error);
      else onDone();
    });
  }

  return (
    <div className="py-1.5">
      <div className="flex items-center gap-2">
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nume categorie noua"
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") onCancel();
          }}
        />
        <Button
          variant="primary"
          onClick={submit}
          disabled={pending || name.trim().length === 0}
        >
          {pending ? "..." : "Adauga"}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Renunta
        </Button>
      </div>
      {error && (
        <p className="text-[11px] text-rose-300 mt-1">{error}</p>
      )}
    </div>
  );
}

function RenameInline({
  node,
  clientId,
  onDone,
  onCancel,
}: {
  node: CostCategoryNode;
  clientId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(node.name);
  const [pending, startTransition] = useTransition();

  function submit() {
    const trimmed = name.trim();
    if (trimmed.length === 0 || trimmed === node.name) {
      onCancel();
      return;
    }
    startTransition(async () => {
      const result = await renameCategoryAction({
        clientId,
        categoryId: node.id,
        name: trimmed,
      });
      if (!result.error) onDone();
      else onCancel();
    });
  }

  return (
    <div className="flex items-center gap-2 flex-1">
      <Input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") onCancel();
        }}
        onBlur={submit}
      />
      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="p-1 text-primary hover:text-primary-light"
      >
        <Check size={12} />
      </button>
    </div>
  );
}

function DeleteCategoryButton({
  node,
  clientId,
  onDone,
}: {
  node: CostCategoryNode;
  clientId: string;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (
      !confirm(
        `Sterg categoria "${node.name}"? Aceasta actiune se inregistreaza in istoric.`
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      const result = await deleteCategoryAction({
        clientId,
        categoryId: node.id,
      });
      if (result.error) {
        setError(result.error);
        alert(result.error);
      } else {
        onDone();
      }
    });
  }

  return (
    <Tooltip content={error ?? "Sterge categoria. Trebuie sa muti intai conturile alocate la alta categorie."}>
      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="p-1 text-gray hover:text-rose-300"
      >
        <Trash2 size={11} />
      </button>
    </Tooltip>
  );
}

/* -------------------------------------------------------------------------- */
/*                           ACCOUNT LIST (PASUL 3)                            */
/* -------------------------------------------------------------------------- */

function AccountListPanel({
  accounts,
  totalAccounts,
  unmappedCount,
  filter,
  onFilterChange,
  tree,
  clientId,
  verticalsEnabled,
  verticals,
  onMutate,
}: {
  accounts: AccountListItem[];
  totalAccounts: number;
  unmappedCount: number;
  filter: Filter;
  onFilterChange: (v: Filter) => void;
  tree: CostCategoryNode[];
  clientId: string;
  verticalsEnabled: boolean;
  verticals: VerticalView[];
  onMutate: () => void;
}) {
  const expensePicker = flattenTreeForPicker(tree, "expense");
  const revenuePicker = flattenTreeForPicker(tree, "revenue");

  return (
    <div className="rounded-xl border border-dark-3 bg-dark-2 p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3
            className="text-[14px] font-semibold text-white"
            style={{ letterSpacing: "-0.04em" }}
          >
            Conturile firmei
          </h3>
          <p
            className="text-[11px] text-gray mt-0.5"
            style={{ letterSpacing: "-0.02em" }}
          >
            {totalAccounts} conturi clasa 6 si 7 cu rulaj. {unmappedCount}{" "}
            nemapate.
          </p>
        </div>
        <ToggleGroup<Filter>
          value={filter}
          onChange={onFilterChange}
          options={[
            { value: "all", label: "Toate" },
            {
              value: "unmapped",
              label: "Nemapate",
              count: unmappedCount,
              countTone: unmappedCount > 0 ? "danger" : "neutral",
            },
            { value: "expense", label: "Cheltuieli" },
            { value: "revenue", label: "Venituri" },
          ]}
        />
      </div>

      {accounts.length === 0 ? (
        <p
          className="text-[13px] text-gray italic py-6 text-center"
          style={{ letterSpacing: "-0.02em" }}
        >
          Niciun cont pentru filtrul curent.
        </p>
      ) : (
        <ul className="divide-y divide-dark-3">
          {accounts.map((account) => (
            <AccountRow
              key={account.cont}
              account={account}
              picker={
                account.kind === "expense" ? expensePicker : revenuePicker
              }
              clientId={clientId}
              verticalsEnabled={verticalsEnabled}
              verticals={verticals}
              onMutate={onMutate}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function AccountRow({
  account,
  picker,
  clientId,
  verticalsEnabled,
  verticals,
  onMutate,
}: {
  account: AccountListItem;
  picker: FlatNode[];
  clientId: string;
  verticalsEnabled: boolean;
  verticals: VerticalView[];
  onMutate: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [scope, setScope] = useState<MappingScope>(
    account.currentMapping?.scope ?? "contBase"
  );

  const value = account.currentMapping?.categoryId ?? "";
  const options = [
    { value: "", label: "— Nemapat —" },
    ...picker.map((n) => ({ value: n.id, label: pickerLabel(n) })),
  ];

  function handleChange(newCategoryId: string) {
    startTransition(async () => {
      if (newCategoryId === "") {
        await unmapAccountAction({
          clientId,
          cont: scope === "analytic" ? account.cont : account.contBase,
        });
        // also clear analytic override if present
        if (scope === "analytic") {
          await unmapAccountAction({ clientId, cont: account.cont });
        }
      } else {
        await mapAccountAction({
          clientId,
          cont: scope === "analytic" ? account.cont : account.contBase,
          scope,
          categoryId: newCategoryId,
        });
      }
      onMutate();
    });
  }

  function handleScopeChange(newScope: MappingScope) {
    setScope(newScope);
    // when switching to analytic, copy the base mapping to analytic so the
    // accountant can immediately diverge it. When switching back to contBase,
    // remove the analytic override.
    if (
      newScope === "analytic" &&
      account.currentMapping &&
      !account.hasAnalyticOverride
    ) {
      startTransition(async () => {
        await mapAccountAction({
          clientId,
          cont: account.cont,
          scope: "analytic",
          categoryId: account.currentMapping!.categoryId,
        });
        onMutate();
      });
    } else if (newScope === "contBase" && account.hasAnalyticOverride) {
      startTransition(async () => {
        await unmapAccountAction({ clientId, cont: account.cont });
        onMutate();
      });
    }
  }

  const rulaj = account.kind === "expense" ? account.rulajD : account.rulajC;

  return (
    <li className="flex items-center gap-3 py-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[11px] text-gray tabular-nums shrink-0">
            {account.cont}
          </span>
          <span
            className="text-[13px] text-gray-light truncate"
            style={{ letterSpacing: "-0.02em" }}
            title={account.denumire}
          >
            {account.denumire}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <Tooltip content="Rulajul contului din ultima luna inregistrata. Reper rapid sa vezi ce conturi merita atentie.">
            <span className="font-mono text-[11px] text-gray tabular-nums cursor-help">
              rulaj {formatRon(rulaj)}
            </span>
          </Tooltip>
          {account.currentMapping === null && (
            <Tooltip content="Acest cont nu are categorie atribuita. Pe /firma va aparea grupat generic dupa codul OMFP.">
              <span className="inline-flex items-center gap-1 text-[10px] text-rose-300 cursor-help">
                <AlertTriangle size={10} /> Nemapat
              </span>
            </Tooltip>
          )}
          {account.hasAnalyticOverride && (
            <Tooltip content="Acest cont analitic are propria mapare, diferita de cea a contului de baza.">
              <span className="text-[10px] text-amber-300 cursor-help">
                override analitic
              </span>
            </Tooltip>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <ScopeToggle
          scope={scope}
          isAnalytic={account.cont !== account.contBase}
          onChange={handleScopeChange}
          disabled={pending}
        />
        <div className="w-56">
          <Select
            value={value}
            options={options}
            onChange={handleChange}
          />
        </div>
        {verticalsEnabled && (
          <div className="w-48">
            <VerticalPicker
              clientId={clientId}
              cont={account.cont}
              contBase={account.contBase}
              scope={
                account.hasAnalyticVerticalOverride ? "analytic" : "contBase"
              }
              verticals={verticals}
              currentSplits={account.currentAllocation?.splits ?? null}
              defaultVertical={verticals.find((v) => v.isDefault) ?? null}
            />
          </div>
        )}
      </div>
    </li>
  );
}

function ScopeToggle({
  scope,
  isAnalytic,
  onChange,
  disabled,
}: {
  scope: MappingScope;
  isAnalytic: boolean;
  onChange: (s: MappingScope) => void;
  disabled: boolean;
}) {
  if (!isAnalytic) {
    // Cont is already the base (e.g. "641" with no analytic), scope toggle
    // makes no sense — always contBase.
    return null;
  }
  const active = scope === "analytic";
  return (
    <Tooltip
      content={
        active
          ? "Acest cont analitic are propria mapare. Click pentru a-l face sa mosteneasca maparea bazei (ex: 628 = 'Servicii externe' pentru toate 628.xx)."
          : "Acest cont analitic mosteneste maparea bazei. Click pentru a-l mapa individual (ex: 628.01 NOLICH = 'Outsourcing IT' separat de restul 628.xx)."
      }
    >
      <button
        type="button"
        onClick={() => onChange(active ? "contBase" : "analytic")}
        disabled={disabled}
        className={`font-mono text-[10px] uppercase tracking-wider px-2 py-1 rounded border transition-colors ${
          active
            ? "border-amber-300/30 bg-amber-300/10 text-amber-300"
            : "border-dark-3 bg-dark-3/50 text-gray hover:text-gray-light"
        }`}
      >
        {active ? "individual" : "din baza"}
      </button>
    </Tooltip>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  HELPERS                                   */
/* -------------------------------------------------------------------------- */

const RON = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 0 });

function formatRon(value: number): string {
  if (value === 0) return "0";
  return RON.format(Math.round(value));
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

function monthLabel(year: number, month: number): string {
  return `${MONTHS[month - 1]} ${year}`;
}

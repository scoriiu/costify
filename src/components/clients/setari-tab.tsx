"use client";

/**
 * Setari tab — per-client configuration.
 *
 * Three sections:
 *   1. Informatii generale  — name, CUI, CAEN (editable)
 *   2. Regim fiscal         — timeline of tax regime transitions
 *   3. Zona periculoasa     — delete historical data (destructive)
 *
 * The regime timeline is the heart of this page. It matches how Romanian
 * accountants actually think about tax regimes: a company has ONE regime at
 * a time, changing only when there's a legal transition (depasire plafon,
 * schimbare forma juridica, etc). Most clients will have 1-2 rows here.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, FileText, Calendar, ArrowRight, Plus, Pencil, Trash2, AlertTriangle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { TaxRegime } from "@/modules/accounts";
import {
  updateClientInfoAction,
  createTaxRegimeTransitionAction,
  updateTaxRegimeTransitionAction,
  deleteTaxRegimeTransitionAction,
} from "@/modules/clients/actions";

export interface TransitionView {
  id: string;
  startDate: string; // ISO
  taxRegime: TaxRegime;
  reason: string | null;
}

interface Props {
  client: {
    id: string;
    slug: string;
    name: string;
    cui: string | null;
    caen: string | null;
    createdAt: string;
  };
  entryCount: number;
  transitions: TransitionView[];
  onOpenDeleteModal: () => void;
}

const REGIME_OPTIONS = [
  { value: "profit_standard", label: "Impozit pe profit (16%)" },
  { value: "profit_micro_1", label: "Microintreprindere 1%" },
  { value: "profit_micro_3", label: "Microintreprindere 3%" },
  { value: "imca", label: "Impozit minim (IMCA)" },
  { value: "profit_specific", label: "Impozit specific (HoReCa)" },
  { value: "deferred", label: "Impozit amanat" },
];

const REGIME_ACCOUNT: Record<TaxRegime, string> = {
  profit_standard: "691",
  profit_micro_1: "698",
  profit_micro_3: "698",
  profit_specific: "695",
  imca: "697",
  deferred: "698",
};

function regimeLabel(r: TaxRegime): string {
  return REGIME_OPTIONS.find((o) => o.value === r)?.label ?? r;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  // Inception transitions are stored at 1970-01-01. Render as "De la inceput".
  if (d.getUTCFullYear() <= 1970) return "De la inceput";
  return d.toLocaleDateString("ro-RO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function isInception(iso: string): boolean {
  return new Date(iso).getUTCFullYear() <= 1970;
}

export function SetariTab({ client, entryCount, transitions, onOpenDeleteModal }: Props) {
  return (
    <div className="space-y-6 max-w-3xl">
      <GeneralInfoSection client={client} />
      <TaxRegimeSection clientId={client.id} transitions={transitions} />
      <DangerZoneSection entryCount={entryCount} onDelete={onOpenDeleteModal} />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Section: Informatii generale
// ──────────────────────────────────────────────────────────────────────────

function GeneralInfoSection({ client }: { client: Props["client"] }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(client.name);
  const [cui, setCui] = useState(client.cui ?? "");
  const [caen, setCaen] = useState(client.caen ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function onSave() {
    setError(null);
    startTransition(async () => {
      const result = await updateClientInfoAction({
        clientId: client.id,
        name: name.trim(),
        cui: cui.trim() || null,
        caen: caen.trim() || null,
      });
      if (!result.ok) {
        setError(result.error ?? "Eroare");
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  function onCancel() {
    setName(client.name);
    setCui(client.cui ?? "");
    setCaen(client.caen ?? "");
    setError(null);
    setEditing(false);
  }

  const createdLabel = new Date(client.createdAt).toLocaleDateString("ro-RO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <section
      className="rounded-xl border border-dark-3 bg-dark-2 p-5 sm:p-6"
      data-testid="setari-informatii-generale"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <Building2 size={16} className="text-primary" />
          <h2
            className="text-[16px] font-semibold text-white"
            style={{ letterSpacing: "-0.04em" }}
          >
            Informatii generale
          </h2>
        </div>
        {!editing && (
          <Button variant="ghost" onClick={() => setEditing(true)}>
            <Pencil size={13} /> Editeaza
          </Button>
        )}
      </div>

      <div className="mt-5">
        {editing ? (
          <div className="space-y-4">
            <Input
              id="client-name"
              label="Nume firma"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex. 4Walls Studio SRL"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                id="client-cui"
                label="CUI"
                value={cui}
                onChange={(e) => setCui(e.target.value)}
                placeholder="RO12345678"
              />
              <Input
                id="client-caen"
                label="CAEN"
                value={caen}
                onChange={(e) => setCaen(e.target.value)}
                placeholder="6920"
              />
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <div className="flex items-center gap-2 pt-2">
              <Button onClick={onSave} disabled={isPending || !name.trim()}>
                {isPending ? "Se salveaza..." : "Salveaza"}
              </Button>
              <Button variant="ghost" onClick={onCancel} disabled={isPending}>
                Anuleaza
              </Button>
            </div>
          </div>
        ) : (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
            <Field label="Nume firma" value={client.name} mono={false} />
            <Field label="CUI" value={client.cui ?? "—"} />
            <Field label="CAEN" value={client.caen ?? "—"} />
            <Field label="Data creare" value={createdLabel} mono={false} icon={<Calendar size={12} className="text-gray" />} />
          </dl>
        )}
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  mono = true,
  icon,
}: {
  label: string;
  value: string;
  mono?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <dt
        className="font-mono text-[11px] font-medium uppercase text-gray"
        style={{ letterSpacing: "-0.04em" }}
      >
        {label}
      </dt>
      <dd
        className={`mt-1 flex items-center gap-1.5 text-[14px] text-white ${mono ? "font-mono" : ""}`}
        style={{ letterSpacing: "-0.02em" }}
      >
        {icon}
        {value}
      </dd>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Section: Regim fiscal (timeline)
// ──────────────────────────────────────────────────────────────────────────

function TaxRegimeSection({
  clientId,
  transitions,
}: {
  clientId: string;
  transitions: TransitionView[];
}) {
  const [modal, setModal] = useState<
    | { mode: "add" }
    | { mode: "edit"; transition: TransitionView }
    | null
  >(null);

  const sorted = [...transitions].sort(
    (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
  );
  const current = sorted[0];
  const history = sorted.slice(1);

  return (
    <section
      className="rounded-xl border border-dark-3 bg-dark-2 p-5 sm:p-6"
      data-testid="setari-regim-fiscal"
      id="regim-fiscal"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-2.5">
          <FileText size={16} className="text-primary mt-0.5" />
          <div>
            <h2
              className="text-[16px] font-semibold text-white"
              style={{ letterSpacing: "-0.04em" }}
            >
              Regim fiscal
            </h2>
            <p className="mt-1 text-sm text-gray-light" style={{ letterSpacing: "-0.02em" }}>
              Istoric al tranzitiilor fiscale ale firmei. Fiecare raport CPP
              foloseste regimul valabil la data perioadei.
            </p>
          </div>
        </div>
        <Button variant="ghost" onClick={() => setModal({ mode: "add" })}>
          <Plus size={13} /> Adauga tranzitie
        </Button>
      </div>

      <div className="mt-6 space-y-4">
        {current && (
          <TimelineItem
            transition={current}
            isCurrent
            canDelete={history.length > 0}
            onEdit={() => setModal({ mode: "edit", transition: current })}
            clientId={clientId}
          />
        )}
        {history.length > 0 && (
          <>
            <div className="flex items-center gap-2 pt-2">
              <span
                className="font-mono text-[11px] font-medium uppercase text-gray"
                style={{ letterSpacing: "-0.04em" }}
              >
                Istoric
              </span>
              <div className="h-px flex-1 bg-dark-3" />
            </div>
            {history.map((t) => (
              <TimelineItem
                key={t.id}
                transition={t}
                isCurrent={false}
                canDelete={true}
                onEdit={() => setModal({ mode: "edit", transition: t })}
                clientId={clientId}
              />
            ))}
          </>
        )}
      </div>

      {modal && (
        <TransitionModal
          clientId={clientId}
          mode={modal.mode}
          initial={modal.mode === "edit" ? modal.transition : null}
          existing={transitions}
          onClose={() => setModal(null)}
        />
      )}
    </section>
  );
}

function TimelineItem({
  transition,
  isCurrent,
  canDelete,
  onEdit,
  clientId,
}: {
  transition: TransitionView;
  isCurrent: boolean;
  canDelete: boolean;
  onEdit: () => void;
  clientId: string;
}) {
  const router = useRouter();
  const [isDeleting, startDelete] = useTransition();
  const inception = isInception(transition.startDate);

  function onDelete() {
    if (!confirm("Stergi aceasta tranzitie? Rapoartele CPP vor recalcula automat.")) return;
    startDelete(async () => {
      const result = await deleteTaxRegimeTransitionAction({
        clientId,
        transitionId: transition.id,
      });
      if (result.ok) router.refresh();
    });
  }

  const account = REGIME_ACCOUNT[transition.taxRegime];

  return (
    <div
      className={`flex items-start gap-3 rounded-lg border p-4 transition-colors ${
        isCurrent
          ? "border-primary/30 bg-primary/5"
          : "border-dark-3 bg-dark-2/60"
      }`}
      data-testid="timeline-item"
      data-regime={transition.taxRegime}
      data-current={isCurrent ? "true" : "false"}
    >
      <div
        className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
          isCurrent ? "bg-primary" : "border border-gray/40 bg-dark-3"
        }`}
      />
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="font-mono text-[12px] text-gray"
            style={{ letterSpacing: "-0.02em" }}
          >
            {isCurrent ? (inception ? "De la inceput — prezent" : `${formatDate(transition.startDate)} — prezent`) : formatDate(transition.startDate)}
          </span>
          {isCurrent && (
            <span className="font-mono text-[10px] uppercase text-primary px-1.5 py-0.5 rounded bg-primary/10" style={{ letterSpacing: "-0.02em" }}>
              Curent
            </span>
          )}
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <span
            className="text-[15px] font-semibold text-white"
            style={{ letterSpacing: "-0.04em" }}
          >
            {regimeLabel(transition.taxRegime)}
          </span>
          <span className="font-mono text-[11px] text-gray">
            · Cont {account}
          </span>
        </div>
        {transition.reason && (
          <p
            className="mt-1.5 text-[13px] text-gray-light italic"
            style={{ letterSpacing: "-0.02em" }}
          >
            {transition.reason}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={onEdit}
          className="flex h-8 w-8 items-center justify-center rounded-md text-gray transition-colors hover:bg-dark-3 hover:text-white"
          aria-label="Editeaza"
        >
          <Pencil size={13} />
        </button>
        {canDelete && !isCurrent && (
          <button
            type="button"
            onClick={onDelete}
            disabled={isDeleting}
            className="flex h-8 w-8 items-center justify-center rounded-md text-gray transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-40"
            aria-label="Sterge"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Modal: Add / Edit transition
// ──────────────────────────────────────────────────────────────────────────

function TransitionModal({
  clientId,
  mode,
  initial,
  existing,
  onClose,
}: {
  clientId: string;
  mode: "add" | "edit";
  initial: TransitionView | null;
  existing: TransitionView[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [startDate, setStartDate] = useState(
    initial ? initial.startDate.slice(0, 10) : new Date().toISOString().slice(0, 10)
  );
  const [taxRegime, setTaxRegime] = useState<TaxRegime>(
    initial?.taxRegime ?? "profit_standard"
  );
  const [reason, setReason] = useState(initial?.reason ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit() {
    setError(null);
    startTransition(async () => {
      const result =
        mode === "edit" && initial
          ? await updateTaxRegimeTransitionAction({
              clientId,
              transitionId: initial.id,
              startDate,
              taxRegime,
              reason: reason.trim() || null,
            })
          : await createTaxRegimeTransitionAction({
              clientId,
              startDate,
              taxRegime,
              reason: reason.trim() || null,
            });

      if (!result.ok) {
        setError(result.error ?? "Eroare");
        return;
      }
      router.refresh();
      onClose();
    });
  }

  // Effect preview: what regime applies before and after this transition?
  const sortedOthers = existing
    .filter((t) => t.id !== initial?.id)
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  const previousTransition = sortedOthers
    .filter((t) => t.startDate.slice(0, 10) < startDate)
    .pop();
  const nextTransition = sortedOthers.find((t) => t.startDate.slice(0, 10) > startDate);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-xl border border-dark-3 bg-dark-2 p-6 shadow-2xl">
        <h3
          className="text-[18px] font-semibold text-white"
          style={{ letterSpacing: "-0.04em" }}
        >
          {mode === "edit" ? "Editeaza tranzitie" : "Tranzitie fiscala noua"}
        </h3>
        <p
          className="mt-1.5 text-sm text-gray-light"
          style={{ letterSpacing: "-0.02em" }}
        >
          {mode === "edit"
            ? "Modifica data sau regimul acestei tranzitii."
            : "Inregistreaza o schimbare de regim fiscal (ex: trecere pe micro, depasire plafon)."}
        </p>

        <div className="mt-5 space-y-4">
          <div>
            <label
              htmlFor="transition-start-date"
              className="mb-1.5 block font-mono text-[11px] font-medium uppercase text-gray"
              style={{ letterSpacing: "-0.04em" }}
            >
              De la data
            </label>
            <input
              id="transition-start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-10 w-full rounded-[10px] border border-dark-3 bg-dark-2 px-3.5 font-mono text-sm text-white focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
          </div>

          <div>
            <label
              className="mb-1.5 block font-mono text-[11px] font-medium uppercase text-gray"
              style={{ letterSpacing: "-0.04em" }}
            >
              Regim fiscal nou
            </label>
            <Select
              value={taxRegime}
              options={REGIME_OPTIONS}
              onChange={(v) => setTaxRegime(v as TaxRegime)}
            />
          </div>

          <Input
            id="transition-reason"
            label="Motiv (optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="ex. depasire plafon 500k EUR"
          />

          <EffectPreview
            startDate={startDate}
            taxRegime={taxRegime}
            previous={previousTransition ?? null}
            next={nextTransition ?? null}
          />

          {error && <p className="text-sm text-danger">{error}</p>}
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            Anuleaza
          </Button>
          <Button onClick={onSubmit} disabled={isPending || !startDate}>
            {isPending ? "Se salveaza..." : mode === "edit" ? "Salveaza" : "Adauga tranzitie"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function EffectPreview({
  startDate,
  taxRegime,
  previous,
  next,
}: {
  startDate: string;
  taxRegime: TaxRegime;
  previous: TransitionView | null;
  next: TransitionView | null;
}) {
  if (!startDate) return null;

  const fromLabel = formatDate(startDate);

  return (
    <div
      className="rounded-lg border border-primary/20 bg-primary/5 p-3.5"
      data-testid="effect-preview"
    >
      <p
        className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase text-primary"
        style={{ letterSpacing: "-0.04em" }}
      >
        <Check size={12} />
        Ce se va intampla
      </p>
      <ul className="mt-2 space-y-1.5 text-[13px] text-gray-light" style={{ letterSpacing: "-0.02em" }}>
        {previous && (
          <li className="flex items-start gap-1.5">
            <ArrowRight size={12} className="mt-1 shrink-0 text-gray" />
            <span>
              Inainte de <span className="font-mono text-white">{fromLabel}</span>:{" "}
              <span className="text-white">{regimeLabel(previous.taxRegime)}</span>
            </span>
          </li>
        )}
        <li className="flex items-start gap-1.5">
          <ArrowRight size={12} className="mt-1 shrink-0 text-primary" />
          <span>
            De la <span className="font-mono text-white">{fromLabel}</span>
            {next && (
              <>
                {" "}pana la{" "}
                <span className="font-mono text-white">{formatDate(next.startDate)}</span>
              </>
            )}
            {!next && " si in continuare"}:{" "}
            <span className="text-white">{regimeLabel(taxRegime)}</span>
          </span>
        </li>
        {next && (
          <li className="flex items-start gap-1.5">
            <ArrowRight size={12} className="mt-1 shrink-0 text-gray" />
            <span>
              De la <span className="font-mono text-white">{formatDate(next.startDate)}</span>:{" "}
              <span className="text-white">{regimeLabel(next.taxRegime)}</span>
            </span>
          </li>
        )}
      </ul>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Section: Zona periculoasa
// ──────────────────────────────────────────────────────────────────────────

function DangerZoneSection({
  entryCount,
  onDelete,
}: {
  entryCount: number;
  onDelete: () => void;
}) {
  return (
    <section
      className="rounded-xl border border-danger/20 bg-danger/5 p-5 sm:p-6"
      data-testid="setari-zona-periculoasa"
    >
      <div className="flex items-start gap-2.5">
        <AlertTriangle size={16} className="text-danger mt-0.5" />
        <div>
          <h2
            className="text-[16px] font-semibold text-white"
            style={{ letterSpacing: "-0.04em" }}
          >
            Zona periculoasa
          </h2>
          <p
            className="mt-1 text-sm text-gray-light"
            style={{ letterSpacing: "-0.02em" }}
          >
            Operatii ireversibile. Actiunile de aici pot sterge date.
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-dark-3 bg-dark-2 p-4">
        <div>
          <p
            className="text-[14px] font-semibold text-white"
            style={{ letterSpacing: "-0.04em" }}
          >
            Sterge date istorice
          </p>
          <p className="mt-0.5 text-sm text-gray-light" style={{ letterSpacing: "-0.02em" }}>
            {entryCount > 0
              ? `Sterge intrari din jurnal de la o data anumita. Util pentru corectii.`
              : "Nu exista intrari in jurnal."}
          </p>
        </div>
        <Button variant="danger" onClick={onDelete} disabled={entryCount === 0}>
          <Trash2 size={13} /> Sterge date...
        </Button>
      </div>
    </section>
  );
}

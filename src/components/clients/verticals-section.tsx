"use client";

/**
 * Setari → "Verticale de business" section.
 *
 * Two visual states, no enabled-but-empty middle ground:
 *
 *   OFF: a short pitch + single button "Activeaza verticale" that opens a
 *        bootstrap modal asking for the first 1-3 vertical names. Saving
 *        creates them along with the default "Toata firma" fallback in one
 *        round trip, then redirects to /clients/[slug]?tab=mapari-cashflow
 *        so the accountant sees the result immediately.
 *
 *   ON:  list of current verticals with Add/Rename/Delete, plus a small
 *        "Dezactiveaza" link that hides the column and the /firma filter
 *        without losing any rows.
 *
 * Allocation editing lives in the Mapari Cashflow tab, not here — this section
 * is purely about the vertical list.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Layers, Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { VerticalView } from "@/modules/verticals";
import {
  enableVerticalsAction,
  disableVerticalsAction,
  createVerticalAction,
  renameVerticalAction,
  deleteVerticalAction,
} from "@/modules/verticals/actions";

interface Props {
  clientId: string;
  clientSlug: string;
  enabled: boolean;
  verticals: VerticalView[];
}

export function VerticalsSection({ clientId, clientSlug, enabled, verticals }: Props) {
  if (!enabled) {
    return <DisabledState clientId={clientId} clientSlug={clientSlug} />;
  }
  return (
    <EnabledState
      clientId={clientId}
      clientSlug={clientSlug}
      verticals={verticals}
    />
  );
}

/* -------------------------------------------------------------------------- */
/*                                  OFF state                                 */
/* -------------------------------------------------------------------------- */

function DisabledState({ clientId, clientSlug }: { clientId: string; clientSlug: string }) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <section className="rounded-xl border border-dark-3 bg-dark-2 p-5">
        <div className="flex items-start gap-3">
          <Layers size={16} className="text-gray mt-1 shrink-0" />
          <div className="flex-1">
            <h3
              className="text-[16px] font-semibold text-white"
              style={{ letterSpacing: "-0.04em" }}
            >
              Verticale de business
            </h3>
            <p
              className="mt-1 text-[13px] text-gray-light max-w-2xl"
              style={{ letterSpacing: "-0.02em" }}
            >
              Daca firma are mai multe linii distincte de business
              (Outsourcing, Recruitment, Coworking, sau alte proiecte), poti
              vedea cat aduce si cheltuieste fiecare separat.
            </p>
            <p
              className="mt-1 text-[12px] text-gray max-w-2xl"
              style={{ letterSpacing: "-0.02em" }}
            >
              Cele mai multe firme nu au nevoie de asta. Poti activa oricand
              si fara consecinte — datele existente raman neatinse.
            </p>
            <div className="mt-4">
              <Button variant="primary" onClick={() => setModalOpen(true)}>
                Activeaza verticale
              </Button>
            </div>
          </div>
        </div>
      </section>
      {modalOpen && (
        <ActivateModal
          clientId={clientId}
          clientSlug={clientSlug}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}

function ActivateModal({
  clientId,
  clientSlug,
  onClose,
}: {
  clientId: string;
  clientSlug: string;
  onClose: () => void;
}) {
  const router = useRouter();
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
      setError(
        "Adauga cel putin o verticala (de exemplu numele unei linii de business)"
      );
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

      router.push(`/clients/${clientSlug}?tab=mapari-cashflow`);
      router.refresh();
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
          Scrie numele liniilor de business pe care vrei sa le urmaresti.
          Poti adauga sau modifica oricand.
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
                  idx === 0
                    ? "Outsourcing"
                    : idx === 1
                    ? "Recruitment"
                    : idx === 2
                    ? "Coworking"
                    : "Alt nume"
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
          Verticala &quot;Toata firma&quot; se creeaza automat ca fallback
          pentru conturi nealocate.
        </p>
        {error && (
          <p className="mt-3 text-[12px] text-rose-300">{error}</p>
        )}
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

/* -------------------------------------------------------------------------- */
/*                                  ON state                                  */
/* -------------------------------------------------------------------------- */

function EnabledState({
  clientId,
  clientSlug,
  verticals,
}: {
  clientId: string;
  clientSlug: string;
  verticals: VerticalView[];
}) {
  const router = useRouter();
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
      router.refresh();
    });
  }

  return (
    <section className="rounded-xl border border-dark-3 bg-dark-2 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Layers size={16} className="text-primary mt-1 shrink-0" />
          <div>
            <h3
              className="text-[16px] font-semibold text-white"
              style={{ letterSpacing: "-0.04em" }}
            >
              Verticale de business
            </h3>
            <p
              className="mt-1 text-[13px] text-gray-light"
              style={{ letterSpacing: "-0.02em" }}
            >
              {verticals.length} verticale active. Aloca conturi in tab-ul{" "}
              <a
                href={`/clients/${clientSlug}?tab=mapari-cashflow`}
                className="text-primary hover:text-primary-light underline"
              >
                Mapari Cashflow
              </a>
              .
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={deactivate}
          disabled={pending}
          className="text-[11px] text-gray hover:text-gray-light"
          style={{ letterSpacing: "-0.02em" }}
        >
          Dezactiveaza
        </button>
      </div>

      <ul className="mt-5 space-y-1">
        {verticals.map((v) => (
          <VerticalRow key={v.id} vertical={v} clientId={clientId} />
        ))}
      </ul>

      {adding ? (
        <AddVerticalInline
          clientId={clientId}
          onDone={() => {
            setAdding(false);
            router.refresh();
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-3 inline-flex items-center gap-1.5 text-[12px] text-primary hover:text-primary-light"
          style={{ letterSpacing: "-0.02em" }}
        >
          <Plus size={12} /> Adauga verticala
        </button>
      )}
    </section>
  );
}

function VerticalRow({
  vertical,
  clientId,
}: {
  vertical: VerticalView;
  clientId: string;
}) {
  const router = useRouter();
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
      else router.refresh();
    });
  }

  if (renaming) {
    return (
      <li>
        <RenameInline
          vertical={vertical}
          clientId={clientId}
          onDone={() => {
            setRenaming(false);
            router.refresh();
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
          <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-gray">
            implicit
          </span>
        )}
      </span>
      <span className="font-mono text-[11px] text-gray tabular-nums shrink-0">
        {vertical.allocationCount} conturi
      </span>
      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1">
        <button
          type="button"
          onClick={() => setRenaming(true)}
          title="Redenumeste"
          className="p-1 text-gray hover:text-primary"
        >
          <Pencil size={11} />
        </button>
        {!vertical.isDefault && (
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            title="Sterge"
            className="p-1 text-gray hover:text-rose-300"
          >
            <Trash2 size={11} />
          </button>
        )}
      </div>
    </li>
  );
}

function RenameInline({
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

"use client";

/**
 * Setari tab — per-client configuration.
 *
 * Sections:
 *   1. Informatii generale  — name, CUI, CAEN (editable)
 *   2. Acces / Publicare / Istoric (server-rendered slots)
 *   3. Zona periculoasa     — delete historical data (destructive)
 *
 * Regim fiscal is NOT managed here anymore — it is auto-detected from the
 * registru jurnal by `detectRegimeForPeriod` and displayed in the CPP tab.
 * The accountant has nothing to configure; the journal is the source of
 * truth.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Calendar, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateClientInfoAction } from "@/modules/clients/actions";

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
  onOpenDeleteModal: () => void;
  /** Server-rendered "Acces clientului" section. Passed as a slot so server data
   *  (current accesses) can be fetched without making the whole tab a server component. */
  accessSection?: React.ReactNode;
  /** Server-rendered "Publicare" section. Same pattern as accessSection. */
  publishSection?: React.ReactNode;
  /** Server-rendered "Istoric actiuni" section. Same pattern. */
  auditSection?: React.ReactNode;
}

export function SetariTab({
  client,
  entryCount,
  onOpenDeleteModal,
  accessSection,
  publishSection,
  auditSection,
}: Props) {
  return (
    <div className="space-y-6 max-w-3xl">
      <GeneralInfoSection client={client} />
      {accessSection}
      {publishSection}
      {auditSection}
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

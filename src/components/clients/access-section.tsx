"use client";

/**
 * "Acces clientului" section inside Setari tab.
 *
 * Shows the list of OWNER users who can view this client's /firma dashboard,
 * lets the accountant grant new access (email + name) and revoke existing ones.
 *
 * When a new user is created, the temporary password is shown ONCE — the
 * accountant must share it with the patron through a side channel.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Users, Plus, Trash2, Eye, Check, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  grantClientAccessAction,
  revokeClientAccessAction,
} from "@/modules/roles/actions";

export interface AccessRow {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  createdAt: string;
}

interface Props {
  clientId: string;
  clientSlug: string;
  accesses: AccessRow[];
}

export function AccessSection({ clientId, clientSlug, accesses }: Props) {
  const [adding, setAdding] = useState(false);

  return (
    <section
      className="rounded-xl border border-dark-3 bg-dark-2 p-5 sm:p-6"
      data-testid="setari-acces-clientului"
    >
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <Users size={16} className="text-primary" />
          <div>
            <h2
              className="text-[16px] font-semibold text-white"
              style={{ letterSpacing: "-0.04em" }}
            >
              Acces clientului
            </h2>
            <p
              className="mt-1 text-[12px] text-gray"
              style={{ letterSpacing: "-0.02em" }}
            >
              Patronul firmei poate vedea singur datele in vederea Firma.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/firma?as=${clientId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-[10px] border border-dark-3 bg-dark px-3 py-2 text-[12px] font-medium text-gray-light hover:text-white hover:border-primary/40 transition-colors"
          >
            <Eye size={12} />
            Vezi ca firma
          </a>
          {!adding && (
            <Button onClick={() => setAdding(true)} variant="ghost">
              <Plus size={14} className="mr-1.5" />
              Adauga
            </Button>
          )}
        </div>
      </header>

      {adding && (
        <AddAccessForm
          clientId={clientId}
          clientSlug={clientSlug}
          onClose={() => setAdding(false)}
        />
      )}

      <ul className="mt-5 divide-y divide-dark-3">
        {accesses.length === 0 ? (
          <li className="py-4">
            <p
              className="text-[13px] text-gray"
              style={{ letterSpacing: "-0.02em" }}
            >
              Nimeni nu are inca acces. Adauga emailul patronului ca sa-i creezi cont.
            </p>
          </li>
        ) : (
          accesses.map((a) => (
            <AccessRowItem
              key={a.id}
              clientId={clientId}
              clientSlug={clientSlug}
              access={a}
            />
          ))
        )}
      </ul>
    </section>
  );
}

function AddAccessForm({
  clientId,
  clientSlug,
  onClose,
}: {
  clientId: string;
  clientSlug: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [tempPw, setTempPw] = useState<string | null>(null);
  const [createdEmail, setCreatedEmail] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await grantClientAccessAction({
        clientId,
        ownerEmail: email.trim(),
        ownerName: name.trim(),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.data?.temporaryPassword) {
        setTempPw(result.data.temporaryPassword);
        setCreatedEmail(result.data.userEmail);
      } else {
        router.refresh();
        onClose();
      }
    });
  }

  if (tempPw && createdEmail) {
    return (
      <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-4">
        <div className="flex items-start gap-2">
          <Check size={14} className="mt-0.5 text-primary" />
          <div className="flex-1">
            <p
              className="text-[13px] font-semibold text-white"
              style={{ letterSpacing: "-0.04em" }}
            >
              Cont creat pentru {createdEmail}
            </p>
            <p
              className="mt-1 text-[12px] text-gray-light"
              style={{ letterSpacing: "-0.02em" }}
            >
              Parola temporara (afisata o singura data, trimite-o patronului):
            </p>
            <code className="mt-2 inline-block rounded bg-dark px-3 py-1.5 font-mono text-[13px] text-primary-light select-all">
              {tempPw}
            </code>
            <div className="mt-3">
              <Button
                onClick={() => {
                  router.refresh();
                  onClose();
                }}
                variant="ghost"
              >
                Am salvat parola, inchide
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-dark-3 bg-dark p-4">
      <div className="space-y-3">
        <div>
          <label
            htmlFor={`access-name-${clientSlug}`}
            className="font-mono text-[11px] font-medium uppercase tracking-wider text-gray"
          >
            Numele patronului
          </label>
          <Input
            id={`access-name-${clientSlug}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ex. Sorin Crisan"
            className="mt-1.5"
          />
        </div>
        <div>
          <label
            htmlFor={`access-email-${clientSlug}`}
            className="font-mono text-[11px] font-medium uppercase tracking-wider text-gray"
          >
            Emailul patronului
          </label>
          <Input
            id={`access-email-${clientSlug}`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ex. sorin@firma.ro"
            type="email"
            className="mt-1.5"
          />
        </div>
        {error && (
          <div className="flex items-start gap-2 rounded border border-red-500/20 bg-red-500/5 p-2">
            <AlertTriangle size={12} className="mt-0.5 text-red-400" />
            <p className="text-[12px] text-red-300" style={{ letterSpacing: "-0.02em" }}>
              {error}
            </p>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Button
            onClick={submit}
            disabled={isPending || !email.trim() || !name.trim()}
          >
            {isPending ? "Se creeaza..." : "Creeaza acces"}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Renunta
          </Button>
        </div>
      </div>
    </div>
  );
}

function AccessRowItem({
  clientId,
  clientSlug,
  access,
}: {
  clientId: string;
  clientSlug: string;
  access: AccessRow;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function doRevoke() {
    setError(null);
    startTransition(async () => {
      const result = await revokeClientAccessAction({ clientId, userId: access.userId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <li className="py-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p
          className="text-[14px] font-medium text-white truncate"
          style={{ letterSpacing: "-0.02em" }}
        >
          {access.userName}
        </p>
        <p className="font-mono text-[11px] text-gray truncate">{access.userEmail}</p>
        {error && (
          <p className="mt-1 text-[11px] text-red-300" style={{ letterSpacing: "-0.02em" }}>
            {error}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {confirming ? (
          <>
            <Button
              variant="danger"
              onClick={doRevoke}
              disabled={isPending}
            >
              {isPending ? "Se revoca..." : "Confirma"}
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Anuleaza
            </Button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="inline-flex items-center gap-1.5 rounded-[10px] border border-dark-3 bg-dark px-3 py-2 text-[12px] font-medium text-gray-light hover:text-red-300 hover:border-red-500/40 transition-colors"
            aria-label={`Revoca acces pentru ${access.userEmail}`}
          >
            <Trash2 size={12} />
            Revoca
          </button>
        )}
      </div>
    </li>
  );
}

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Building2, Database } from "lucide-react";
import { CreateClientDialog } from "./create-client-dialog";
import Link from "next/link";

interface ClientItem {
  id: string;
  slug: string;
  name: string;
  cui: string | null;
  caen: string | null;
  datasetCount: number;
  createdAt: string;
}

interface ClientListProps {
  clients: ClientItem[];
}

export function ClientList({ clients }: ClientListProps) {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div>
      {clients.length > 0 && (
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-[20px] font-semibold text-white" style={{ letterSpacing: "-0.04em" }}>
              {clients.length} Client{clients.length !== 1 ? "s" : ""}
            </h2>
            <p className="text-[14px] text-gray">Manage your client companies</p>
          </div>
          <Button onClick={() => setShowCreate(true)}>
            <Plus size={16} /> Add Client
          </Button>
        </div>
      )}

      {clients.length === 0 ? (
        <EmptyState onAdd={() => setShowCreate(true)} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((client) => (
            <ClientCard key={client.id} client={client} />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateClientDialog onClose={() => setShowCreate(false)} />
      )}
    </div>
  );
}

function ClientCard({ client }: { client: ClientItem }) {
  return (
    <Link
      href={`/clients/${client.slug}`}
      className="group rounded-xl border border-dark-3 bg-dark-2 p-5 transition-all hover:border-primary/20 hover:-translate-y-0.5"
    >
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Building2 size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[16px] font-semibold text-white" style={{ letterSpacing: "-0.04em" }}>
            {client.name}
          </div>
          {client.cui && (
            <div className="font-mono text-[11px] text-gray" style={{ letterSpacing: "-0.04em" }}>CUI: {client.cui}</div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 font-mono text-[11px] text-gray" style={{ letterSpacing: "-0.04em" }}>
        <Database size={12} />
        {client.datasetCount} dataset{client.datasetCount !== 1 ? "s" : ""}
      </div>
    </Link>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-dark-3 py-16">
      <Building2 size={48} className="mb-4 text-gray/40" />
      <h3 className="mb-1 text-[16px] font-semibold text-white" style={{ letterSpacing: "-0.04em" }}>No clients yet</h3>
      <p className="mb-4 text-[14px] text-gray">
        Add your first client company to get started
      </p>
      <Button onClick={onAdd}>
        <Plus size={16} /> Add Client
      </Button>
    </div>
  );
}

"use client";

import { Building2, Upload, FileSpreadsheet, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface ClientInfo {
  id: string;
  slug: string;
  name: string;
  cui: string | null;
  caen: string | null;
}

interface DatasetItem {
  id: string;
  name: string;
  fileName: string;
  sourceType: string;
  status: string;
  createdAt: string;
}

interface ClientDashboardProps {
  client: ClientInfo;
  datasets: DatasetItem[];
}

export function ClientDashboard({ client, datasets }: ClientDashboardProps) {
  return (
    <div>
      <Link
        href="/clients"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray hover:text-white transition-colors"
      >
        <ArrowLeft size={14} /> Back to clients
      </Link>

      <ClientHeader client={client} />

      <div className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Datasets</h3>
          <Link href={`/clients/${client.slug}/import`}>
            <Button variant="primary">
              <Upload size={14} /> Import Journal
            </Button>
          </Link>
        </div>

        {datasets.length === 0 ? (
          <EmptyDatasets slug={client.slug} />
        ) : (
          <DatasetList datasets={datasets} slug={client.slug} />
        )}
      </div>
    </div>
  );
}

function ClientHeader({ client }: { client: ClientInfo }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-dark-3 bg-dark-2 p-6">
      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Building2 size={28} />
      </div>
      <div>
        <h2 className="text-xl font-bold text-white">{client.name}</h2>
        <div className="flex gap-4 text-sm text-gray">
          {client.cui && <span>CUI: {client.cui}</span>}
          {client.caen && <span>CAEN: {client.caen}</span>}
          {!client.cui && !client.caen && <span>No details configured</span>}
        </div>
      </div>
    </div>
  );
}

function EmptyDatasets({ slug }: { slug: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-dark-3 py-12">
      <FileSpreadsheet size={40} className="mb-3 text-gray/40" />
      <h4 className="mb-1 text-sm font-semibold text-white">
        No datasets yet
      </h4>
      <p className="mb-4 text-center text-sm text-gray">
        Upload a jurnal contabil XLSX to see financial reports
      </p>
      <Link href={`/clients/${slug}/import`}>
        <Button>
          <Upload size={14} /> Import Journal
        </Button>
      </Link>
    </div>
  );
}

function DatasetList({ datasets, slug }: { datasets: DatasetItem[]; slug: string }) {
  return (
    <div className="space-y-2">
      {datasets.map((d) => (
        <Link
          key={d.id}
          href={`/clients/${slug}/datasets/${d.id}`}
          className="flex items-center gap-4 rounded-lg border border-dark-3 bg-dark-2 px-5 py-3.5 transition-colors hover:border-primary/30"
        >
          <FileSpreadsheet size={18} className="text-accent shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-white">
              {d.name}
            </div>
            <div className="text-xs text-gray">{d.fileName}</div>
          </div>
          <StatusBadge status={d.status} />
          <div className="text-xs text-gray">
            {new Date(d.createdAt).toLocaleDateString("ro-RO")}
          </div>
        </Link>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ready: "bg-accent/10 text-accent border-accent/20",
    processing: "bg-warn/10 text-warn border-warn/20",
    failed: "bg-danger/10 text-danger border-danger/20",
  };

  return (
    <span
      className={`rounded-md border px-2 py-0.5 text-[0.65rem] font-semibold ${
        styles[status] ?? styles.processing
      }`}
    >
      {status}
    </span>
  );
}

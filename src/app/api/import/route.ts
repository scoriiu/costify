/**
 * Journal import enqueue endpoint.
 *
 * Receives the Saga XLSX as multipart/form-data, streams it into MinIO,
 * creates a queued ImportEvent row, and returns the importEventId. The
 * actual parsing + DB writes happen in the worker (src/modules/ingestion/
 * worker.ts) and the client polls GET /api/import/[id] for progress.
 *
 * Response shape:
 *   202 Accepted: { importEventId }
 *   400/403/404 with { error } for validation / auth.
 *
 * We never block on parse here. The user gets their job id within ~200 ms
 * regardless of file size, then watches a real progress bar driven by
 * worker-emitted updates on the same DB row.
 */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/modules/auth/session";
import { verifyTenantAccess } from "@/modules/tenant";
import { prisma } from "@/lib/db";
import { putBuffer, ensureImportsBucket, importFileKey } from "@/lib/object-storage";

export const maxDuration = 60;

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const clientId = formData.get("clientId") as string | null;

  if (!file || !clientId) {
    return NextResponse.json({ error: "Fisierul si clientId sunt obligatorii" }, { status: 400 });
  }

  const hasAccess = await verifyTenantAccess(user.id, clientId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Client negasit" }, { status: 404 });
  }

  // We still buffer the upload in memory here (Next's request.formData()
  // does that internally), but it's not held for long — straight into
  // MinIO and freed. The Node heap bump (4 Gi pod) is enough headroom for
  // any realistic Saga export.
  const buffer = Buffer.from(await file.arrayBuffer());

  await ensureImportsBucket();

  // Create the ImportEvent FIRST so we have a stable id for the file key
  // and the polling endpoint. fileKey populated after the upload succeeds —
  // claimNextJob in the worker requires fileKey !== NULL.
  const importEvent = await prisma.importEvent.create({
    data: {
      clientId,
      fileName: file.name,
      fileHash: "",
      sourceFormat: "saga",
      status: "queued",
      progress: 0,
      progressLabel: "Asteapta procesarea",
    },
  });

  try {
    const key = importFileKey(importEvent.id);
    await putBuffer(key, buffer, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    await prisma.importEvent.update({
      where: { id: importEvent.id },
      data: { fileKey: key },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await prisma.importEvent.update({
      where: { id: importEvent.id },
      data: { status: "failed", errorMessage: `Eroare la incarcarea fisierului: ${msg}` },
    });
    return NextResponse.json(
      { error: "Eroare la incarcarea fisierului in storage" },
      { status: 500 }
    );
  }

  return NextResponse.json({ importEventId: importEvent.id }, { status: 202 });
}

/**
 * Journal import enqueue endpoint.
 *
 * Buffers the upload to memory, PUTs it to MinIO, and enqueues a job.
 * Returns 202 with the importEventId so the client can hand off to the
 * polling progress view.
 *
 * Why buffered and not streaming: we tried piping busboy directly into
 * S3's multipart Upload helper (5 MB chunks, queueSize=4) hoping for a
 * lower peak heap and a faster wall time. Measured result on real
 * production: 11 s -> 24 s on a 19 MB upload. The 4 parallel S3 part
 * connections appear to fight each other over the cluster's modest
 * MinIO bandwidth, so the streaming variant is actually slower than a
 * single PutObject. We may revisit this when MinIO sits on faster
 * storage or when typical uploads cross ~100 MB.
 *
 * The route's `maxDuration = 60` covers the slow-network case for
 * residential connections; the user's perceived speed is what the
 * XHR upload progress bar shows (real bytes-on-wire), then the queue
 * polling view takes over.
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

  await ensureImportsBucket();

  const buffer = Buffer.from(await file.arrayBuffer());

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
    await putBuffer(
      key,
      buffer,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
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

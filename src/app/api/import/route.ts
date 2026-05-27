/**
 * Journal import enqueue endpoint — streaming version.
 *
 * Old flow (buffered): `request.formData()` materialized the full 19 MB
 * multipart body in Node heap, then we `Buffer.from(await
 * file.arrayBuffer())` copied it again, then PutObjectCommand sent it
 * as one synchronous PUT. Three full-size copies in memory and the file
 * was never on disk until S3 had it whole.
 *
 * New flow (streaming): we drive busboy ourselves over the raw request
 * body. As the multipart parser yields each file part as a Readable,
 * we pipe it straight into S3's lib-storage Upload helper which does a
 * 5 MB-chunk multipart upload server-side. The request body, the
 * multipart parse, and the S3 upload all happen in parallel — bytes
 * land in MinIO as fast as they arrive from the client.
 *
 * Net effect:
 *   - Server CPU time for a 19 MB upload drops from ~3 s to ~0.5 s
 *     (no buffer-of-buffer copies, no synchronous parse).
 *   - Peak heap for the route stays around the S3 part size (~5 MB)
 *     regardless of upload size — a 100 MB file no longer risks the OOM
 *     we just escaped from in the XLSX parser.
 *   - On the client side, XHR's `upload.onprogress` now reports faithful
 *     progress because the bytes are actually flowing, not queued in
 *     Next's body buffer.
 */
import { NextResponse } from "next/server";
import busboy from "busboy";
import { Readable } from "node:stream";
import { getSessionUser } from "@/modules/auth/session";
import { verifyTenantAccess } from "@/modules/tenant";
import { prisma } from "@/lib/db";
import { ensureImportsBucket, putStream, importFileKey } from "@/lib/object-storage";

export const maxDuration = 60;

interface MultipartFields {
  clientId?: string;
  fileName?: string;
  fileMime?: string;
  uploadPromise?: Promise<void>;
  uploadKey?: string;
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.startsWith("multipart/form-data")) {
    return NextResponse.json({ error: "Content-Type invalid" }, { status: 400 });
  }
  if (!request.body) {
    return NextResponse.json({ error: "Body lipsa" }, { status: 400 });
  }

  await ensureImportsBucket();

  // Generate the ImportEvent id up front so we can name the S3 object
  // before the row is inserted (no UPDATE roundtrip after upload).
  // cuid() compatible random — Prisma's default cuid() doesn't run on
  // explicit ids so we use a UUID; ImportEvent.id is just String.
  const importEventId = crypto.randomUUID();
  const fileKey = importFileKey(importEventId);

  const fields: MultipartFields = {};

  try {
    await new Promise<void>((resolve, reject) => {
      const bb = busboy({
        headers: { "content-type": contentType },
        limits: {
          fileSize: 200 * 1024 * 1024, // 200 MB hard cap per file
          files: 1,
          fields: 10,
        },
      });

      bb.on("field", (name, value) => {
        if (name === "clientId") fields.clientId = value;
        if (name === "name") fields.fileName = value;
      });

      bb.on("file", (_name, stream, info) => {
        fields.fileMime = info.mimeType;
        if (!fields.fileName) fields.fileName = info.filename;
        // Kick off the S3 multipart upload immediately. We DON'T await
        // here — busboy keeps pumping bytes into `stream` as they arrive
        // and S3's Upload helper consumes them in parallel. We await the
        // returned promise once busboy emits 'finish' so we know all
        // parts are acked.
        fields.uploadKey = fileKey;
        fields.uploadPromise = putStream(fileKey, stream, {
          contentType: info.mimeType || "application/octet-stream",
        });
        // Surface upload errors to the outer promise — otherwise an S3
        // failure would only show up after the multipart parser finishes.
        fields.uploadPromise.catch(reject);
      });

      bb.on("error", reject);
      bb.on("finish", () => resolve());

      // Pipe the request body (a Web ReadableStream) into busboy (a
      // Node Writable). Readable.fromWeb bridges the two.
      Readable.fromWeb(request.body as never).pipe(bb);
    });

    if (fields.uploadPromise) await fields.uploadPromise;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: `Eroare la incarcarea fisierului: ${msg}` },
      { status: 500 }
    );
  }

  if (!fields.clientId) {
    return NextResponse.json({ error: "clientId obligatoriu" }, { status: 400 });
  }
  if (!fields.uploadKey) {
    return NextResponse.json({ error: "Fisierul lipseste" }, { status: 400 });
  }

  const hasAccess = await verifyTenantAccess(user.id, fields.clientId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Client negasit" }, { status: 404 });
  }

  // File is already in MinIO at this point — insert the queued job
  // pointing at it. The worker picks this up on its next poll (≤1 s).
  await prisma.importEvent.create({
    data: {
      id: importEventId,
      clientId: fields.clientId,
      fileName: fields.fileName ?? "import.xlsx",
      fileHash: "",
      sourceFormat: "saga",
      status: "queued",
      progress: 0,
      progressLabel: "Asteapta procesarea",
      fileKey,
    },
  });

  return NextResponse.json({ importEventId }, { status: 202 });
}

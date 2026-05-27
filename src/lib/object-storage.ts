/**
 * Object storage client — talks S3 protocol to in-cluster MinIO.
 *
 * The MinIO deployment runs alongside Postgres in the costify k3s
 * namespace (devops/minio.yaml). It's not exposed externally — every
 * read/write stays on the cluster's pod-to-pod network. We use the AWS
 * SDK because S3's HTTP API is the de-facto standard for object storage
 * and MinIO speaks it natively; this also keeps the door open for
 * pointing at real S3 (or any other S3-compatible target) by just
 * changing the env vars, with zero code changes.
 *
 * Buckets:
 *   costify-imports  — Saga XLSX uploads awaiting/being processed by the
 *                      import worker. Keys are `<importEventId>.xlsx`,
 *                      deleted after the import completes successfully
 *                      (or after 24 h via a cleanup job, TBD).
 */
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { Readable, PassThrough } from "node:stream";

const ENDPOINT = process.env.S3_ENDPOINT ?? "http://minio:9000";
const ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID ?? "";
const SECRET_ACCESS_KEY = process.env.S3_SECRET_ACCESS_KEY ?? "";
const BUCKET = process.env.S3_BUCKET ?? "costify-imports";

const config: S3ClientConfig = {
  endpoint: ENDPOINT,
  region: "us-east-1",
  credentials: { accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET_ACCESS_KEY },
  // Path-style addressing — MinIO doesn't use virtual-hosted bucket DNS,
  // so we ask for buckets via `http://minio:9000/<bucket>/<key>` instead
  // of `http://<bucket>.minio:9000/<key>`.
  forcePathStyle: true,
};

let cachedClient: S3Client | null = null;
function client(): S3Client {
  if (!cachedClient) cachedClient = new S3Client(config);
  return cachedClient;
}

export function getImportsBucket(): string {
  return BUCKET;
}

/**
 * Make sure the bucket exists. Cheap — runs a HEAD first and only creates
 * if missing. Called once per process at boot.
 */
let ensuredBucket = false;
export async function ensureImportsBucket(): Promise<void> {
  if (ensuredBucket) return;
  try {
    await client().send(new HeadBucketCommand({ Bucket: BUCKET }));
    ensuredBucket = true;
    return;
  } catch (e) {
    // 404 = not there yet; anything else (e.g. wrong creds) re-throws.
    const code = (e as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (code !== 404 && code !== 403) throw e;
  }
  await client().send(new CreateBucketCommand({ Bucket: BUCKET }));
  ensuredBucket = true;
}

export async function putBuffer(key: string, buffer: Buffer, contentType = "application/octet-stream"): Promise<void> {
  await client().send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ContentLength: buffer.length,
    })
  );
}

/**
 * Stream an arbitrary Readable into S3 without buffering the full body
 * in our process memory. Uses the AWS SDK's lib-storage Upload helper,
 * which transparently does S3 multipart upload — each 5 MB chunk is sent
 * as it arrives. Returns once the last part is acknowledged.
 *
 * This is the right shape for the journal import route: we pipe the
 * multipart file part directly from the HTTP request through to S3, so
 * our Node heap never holds the whole 19 MB at once. Pre-refactor the
 * route called `await request.formData()` (buffers everything) and then
 * `Buffer.from(await file.arrayBuffer())` (a second copy). On a 100 MB
 * file that pattern would risk the same V8 OOM we hit with the XLSX
 * parser before the streaming fix.
 */
export interface PutStreamOptions {
  contentType?: string;
  /** Optional onProgress callback receiving bytes uploaded so far. */
  onProgress?: (bytes: number) => void;
}

export async function putStream(
  key: string,
  body: Readable,
  options: PutStreamOptions = {},
): Promise<void> {
  const upload = new Upload({
    client: client(),
    params: {
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: options.contentType ?? "application/octet-stream",
    },
    queueSize: 4,
    partSize: 5 * 1024 * 1024,
  });
  if (options.onProgress) {
    upload.on("httpUploadProgress", (p) => {
      if (typeof p.loaded === "number") options.onProgress!(p.loaded);
    });
  }
  await upload.done();
}

export { PassThrough };

/**
 * Fetch an object as a Buffer. For the import use case the worker calls
 * this exactly once at the start of processing — file sizes are bounded
 * (10s of MB) so we don't need to stream here. If we ever upload files
 * large enough that Buffer materialization hurts, switch to getReadStream
 * which yields the S3 body Readable straight through to the parser.
 */
export async function getBuffer(key: string): Promise<Buffer> {
  const out = await client().send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  if (!out.Body) throw new Error(`S3 GetObject returned empty body for ${key}`);
  const stream = out.Body as Readable;
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : (chunk as Buffer));
  }
  return Buffer.concat(chunks);
}

export async function deleteObject(key: string): Promise<void> {
  await client().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

/**
 * Stable key format for import uploads. Keeping the importEventId as the
 * sole key component (no folders) makes cleanup + auditing trivial: the
 * filename in MinIO matches the row id in ImportEvent.
 */
export function importFileKey(importEventId: string): string {
  return `${importEventId}.xlsx`;
}

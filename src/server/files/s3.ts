import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Readable } from "node:stream";
import { getEnv } from "@/server/config/env";

// S3-compatible private object storage (MinIO locally). Presigned URLs are
// generated against the PUBLIC endpoint so the browser can reach them; the
// server talks to the internal endpoint.

// Read lazily: configuration is validated at server start, not at import.
export const quarantineBucket = () => getEnv().S3_BUCKET_QUARANTINE;
export const cleanBucket = () => getEnv().S3_BUCKET_CLEAN;
export const exportBucket = () => getEnv().S3_BUCKET_EXPORT;

function clientConfig(endpoint: string) {
  const env = getEnv();
  return {
    endpoint,
    region: env.S3_REGION,
    forcePathStyle: true,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    },
  };
}

const globalForS3 = globalThis as unknown as {
  s3Internal?: S3Client;
  s3Public?: S3Client;
};

export function getS3(): S3Client {
  if (!globalForS3.s3Internal) {
    globalForS3.s3Internal = new S3Client(clientConfig(getEnv().S3_ENDPOINT));
  }
  return globalForS3.s3Internal;
}

// Browser-reachable presigner (risk #4: never presign the internal hostname).
export function getS3Public(): S3Client {
  if (!globalForS3.s3Public) {
    globalForS3.s3Public = new S3Client(clientConfig(getEnv().s3PublicEndpoint));
  }
  return globalForS3.s3Public;
}

const UPLOAD_EXPIRY_SECONDS = 5 * 60;
// Attachment URLs expire within 5 minutes (NFR-S-006).
const DOWNLOAD_EXPIRY_SECONDS = 5 * 60;

export async function presignQuarantineUpload(
  objectKey: string,
  maxSizeBytes: number,
): Promise<{ url: string; fields: Record<string, string> }> {
  // POST policy (not PUT) so content-length-range is enforced server-side.
  const post = await createPresignedPost(getS3Public(), {
    Bucket: quarantineBucket(),
    Key: objectKey,
    Conditions: [["content-length-range", 1, maxSizeBytes]],
    Expires: UPLOAD_EXPIRY_SECONDS,
  });
  return { url: post.url, fields: post.fields };
}

export async function headQuarantineObject(objectKey: string) {
  return getS3().send(new HeadObjectCommand({ Bucket: quarantineBucket(), Key: objectKey }));
}

export async function putQuarantineObject(objectKey: string, body: Uint8Array): Promise<void> {
  await getS3().send(
    new PutObjectCommand({
      Bucket: quarantineBucket(),
      Key: objectKey,
      Body: body,
      ContentType: "application/octet-stream",
    }),
  );
}

export async function getQuarantineStream(objectKey: string): Promise<Readable> {
  const result = await getS3().send(
    new GetObjectCommand({ Bucket: quarantineBucket(), Key: objectKey }),
  );
  return result.Body as Readable;
}

export async function getCleanStream(objectKey: string): Promise<Readable> {
  const result = await getS3().send(
    new GetObjectCommand({ Bucket: cleanBucket(), Key: objectKey }),
  );
  if (!result.Body) throw new Error("Attachment object has no body.");
  return result.Body as Readable;
}

export async function promoteToClean(objectKey: string, body: Uint8Array): Promise<void> {
  // Avoid S3 CopyObject here: its successful XML response is deserialized
  // through DOMParser, which is unavailable in Cloudflare Workers. The scan
  // worker already has the size-capped object in memory, so write those same
  // bytes to the clean bucket and then remove the quarantine copy.
  await getS3().send(
    new PutObjectCommand({
      Bucket: cleanBucket(),
      Key: objectKey,
      Body: body,
      ContentType: "application/octet-stream",
    }),
  );
  await getS3().send(new DeleteObjectCommand({ Bucket: quarantineBucket(), Key: objectKey }));
}

export async function deleteQuarantineObject(objectKey: string): Promise<void> {
  await getS3().send(new DeleteObjectCommand({ Bucket: quarantineBucket(), Key: objectKey }));
}

export async function deleteCleanObject(objectKey: string): Promise<void> {
  await getS3().send(new DeleteObjectCommand({ Bucket: cleanBucket(), Key: objectKey }));
}

export async function presignCleanDownload(
  objectKey: string,
  displayName: string,
  contentType: string,
): Promise<string> {
  // Attachment-safe disposition; the filename is display metadata only.
  const safeName = displayName.replace(/[^\w.\- ]+/g, "_").slice(0, 120) || "download";
  return getSignedUrl(
    getS3Public(),
    new GetObjectCommand({
      Bucket: cleanBucket(),
      Key: objectKey,
      ResponseContentDisposition: `attachment; filename="${safeName}"`,
      ResponseContentType: contentType,
    }),
    { expiresIn: DOWNLOAD_EXPIRY_SECONDS },
  );
}

export async function presignExportDownload(
  objectKey: string,
  displayName: string,
): Promise<string> {
  const safeName = displayName.replace(/[^\w.\- ]+/g, "_").slice(0, 120) || "diary-export.zip";
  return getSignedUrl(
    getS3Public(),
    new GetObjectCommand({
      Bucket: exportBucket(),
      Key: objectKey,
      ResponseContentDisposition: `attachment; filename="${safeName}"`,
      ResponseContentType: "application/zip",
    }),
    { expiresIn: DOWNLOAD_EXPIRY_SECONDS },
  );
}

export async function deleteExportObject(objectKey: string): Promise<void> {
  await getS3().send(new DeleteObjectCommand({ Bucket: exportBucket(), Key: objectKey }));
}

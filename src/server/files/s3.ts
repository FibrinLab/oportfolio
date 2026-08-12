import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Readable } from "node:stream";

// S3-compatible private object storage (MinIO locally). Presigned URLs are
// generated against the PUBLIC endpoint so the browser can reach them; the
// server talks to the internal endpoint.

export const QUARANTINE_BUCKET = process.env.S3_BUCKET_QUARANTINE ?? "oportfolio-quarantine";
export const CLEAN_BUCKET = process.env.S3_BUCKET_CLEAN ?? "oportfolio-clean";

function clientConfig(endpoint: string) {
  return {
    endpoint,
    region: process.env.S3_REGION ?? "us-east-1",
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "oportfolio",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "oportfolio_dev",
    },
  };
}

const globalForS3 = globalThis as unknown as {
  s3Internal?: S3Client;
  s3Public?: S3Client;
};

export function getS3(): S3Client {
  if (!globalForS3.s3Internal) {
    globalForS3.s3Internal = new S3Client(
      clientConfig(process.env.S3_ENDPOINT ?? "http://localhost:9000"),
    );
  }
  return globalForS3.s3Internal;
}

// Browser-reachable presigner (risk #4: never presign the internal hostname).
export function getS3Public(): S3Client {
  if (!globalForS3.s3Public) {
    globalForS3.s3Public = new S3Client(
      clientConfig(
        process.env.S3_PUBLIC_ENDPOINT ?? process.env.S3_ENDPOINT ?? "http://localhost:9000",
      ),
    );
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
    Bucket: QUARANTINE_BUCKET,
    Key: objectKey,
    Conditions: [["content-length-range", 1, maxSizeBytes]],
    Expires: UPLOAD_EXPIRY_SECONDS,
  });
  return { url: post.url, fields: post.fields };
}

export async function headQuarantineObject(objectKey: string) {
  return getS3().send(new HeadObjectCommand({ Bucket: QUARANTINE_BUCKET, Key: objectKey }));
}

export async function getQuarantineStream(objectKey: string): Promise<Readable> {
  const result = await getS3().send(
    new GetObjectCommand({ Bucket: QUARANTINE_BUCKET, Key: objectKey }),
  );
  return result.Body as Readable;
}

export async function promoteToClean(objectKey: string): Promise<void> {
  await getS3().send(
    new CopyObjectCommand({
      Bucket: CLEAN_BUCKET,
      Key: objectKey,
      CopySource: `${QUARANTINE_BUCKET}/${encodeURIComponent(objectKey)}`,
    }),
  );
  await getS3().send(new DeleteObjectCommand({ Bucket: QUARANTINE_BUCKET, Key: objectKey }));
}

export async function deleteQuarantineObject(objectKey: string): Promise<void> {
  await getS3().send(new DeleteObjectCommand({ Bucket: QUARANTINE_BUCKET, Key: objectKey }));
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
      Bucket: CLEAN_BUCKET,
      Key: objectKey,
      ResponseContentDisposition: `attachment; filename="${safeName}"`,
      ResponseContentType: contentType,
    }),
    { expiresIn: DOWNLOAD_EXPIRY_SECONDS },
  );
}

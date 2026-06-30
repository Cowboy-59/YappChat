import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Chat media storage on private S3 (spec 001/017). Objects are stored under an
 * unguessable key and never made public; readers get a short-lived presigned
 * GET URL. Credentials come from the default AWS provider chain — the `Andy`
 * profile locally (AWS_PROFILE), a task IAM role in production — so no secret
 * lives in the repo.
 */

const BUCKET = process.env.S3_BUCKET;
const REGION = process.env.AWS_REGION;
const READ_TTL_SECONDS = 60 * 60; // 1h — long enough to view, short enough to expire

let client: S3Client | null = null;
function s3(): S3Client {
  if (!client) client = new S3Client({ region: REGION });
  return client;
}

export function storageConfigured(): boolean {
  return Boolean(BUCKET && REGION);
}

/** Store bytes under `key`; returns the key (persisted in messages.mediaurl). */
export async function putObject(
  key: string,
  body: Buffer,
  contentType: string,
  contentDisposition?: string,
): Promise<string> {
  if (!BUCKET) throw new Error("S3_BUCKET not configured");
  await s3().send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      ContentDisposition: contentDisposition,
    }),
  );
  return key;
}

/** Fetch a stored object's raw bytes (server-side; e.g. FR-019 doc indexing). */
export async function getObjectBytes(key: string): Promise<Buffer> {
  if (!BUCKET) throw new Error("S3_BUCKET not configured");
  const res = await s3().send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  const bytes = await res.Body?.transformToByteArray();
  if (!bytes) throw new Error("empty_object");
  return Buffer.from(bytes);
}

/** Short-lived presigned GET URL for a stored key (for <img src> / download links). */
export async function presignGet(key: string): Promise<string> {
  if (!BUCKET) throw new Error("S3_BUCKET not configured");
  return getSignedUrl(s3(), new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn: READ_TTL_SECONDS });
}

/** A stored attachment, ready for the client to render or download. */
export type Attachment = { url: string; name: string; isImage: boolean };

const IMAGE_EXT = /\.(png|jpe?g|gif|webp)$/i;

/** Presign stored keys into client attachments (filename derived from the key's last segment). */
export async function presignAttachments(keys: string[] | null | undefined): Promise<Attachment[]> {
  if (!keys?.length || !storageConfigured()) return [];
  const out = await Promise.all(
    keys.map(async (key): Promise<Attachment | null> => {
      try {
        const url = await presignGet(key);
        const name = decodeURIComponent(key.split("/").pop() ?? "file");
        return { url, name, isImage: IMAGE_EXT.test(name) };
      } catch {
        return null;
      }
    }),
  );
  return out.filter((a): a is Attachment => a !== null);
}

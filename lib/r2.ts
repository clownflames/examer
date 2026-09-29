import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/* -------------------------------------------------------------------------- */
/*  Config                                                                     */
/* -------------------------------------------------------------------------- */

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME!;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL?.replace(/\/$/, "") ?? "";

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  // Fail loud in dev, so we don't silently break uploads
  console.warn(
    "[r2] Missing R2 env vars. Uploads will fail until they're set."
  );
}

/* -------------------------------------------------------------------------- */
/*  Client                                                                     */
/* -------------------------------------------------------------------------- */

let _client: S3Client | null = null;

export function getR2Client(): S3Client {
  if (_client) return _client;
  _client = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
  return _client;
}

/* -------------------------------------------------------------------------- */
/*  Key builders — keep paths consistent across the app                        */
/* -------------------------------------------------------------------------- */

export function buildAudioKey(
  examId: string,
  userId: string,
  questionId: string
): string {
  const ts = Date.now();
  return `exams/${examId}/${userId}/q-${questionId}-${ts}.webm`;
}

export function buildResumeKey(
  userId: string,
  filename: string
): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `resumes/${userId}/${Date.now()}-${safe}`;
}

export function buildProfileImageKey(
  userId: string,
  ext = "jpg"
): string {
  return `profile/${userId}/${Date.now()}.${ext}`;
}

/* -------------------------------------------------------------------------- */
/*  Presigned upload                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Returns a presigned PUT URL the browser can use to upload directly to R2.
 * Expires in 5 minutes by default.
 */
export async function getUploadPresignedUrl(
  key: string,
  contentType: string,
  expiresIn = 60 * 5
): Promise<string> {
  const client = getR2Client();
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(client, command, { expiresIn });
}

/* -------------------------------------------------------------------------- */
/*  Public URL                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Returns the public URL for a given key. Requires the bucket to have
 * public access enabled, OR a custom domain configured in R2_PUBLIC_URL.
 */
export function getPublicUrl(key: string): string {
  if (!R2_PUBLIC_URL) {
    // Fall back to a signed-ish path — some setups use the R2.dev subdomain.
    return `https://${R2_BUCKET_NAME}.r2.dev/${key}`;
  }
  return `${R2_PUBLIC_URL}/${key}`;
}

/* -------------------------------------------------------------------------- */
/*  Delete                                                                     */
/* -------------------------------------------------------------------------- */

export async function deleteR2Object(key: string): Promise<void> {
  const client = getR2Client();
  await client.send(
    new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    })
  );
}

/**
 * Extract the R2 key from a public URL. Useful when we only store the URL
 * in the DB but need to delete the object later.
 */
export function keyFromPublicUrl(url: string): string | null {
  if (!url) return null;
  const base = R2_PUBLIC_URL || `https://${R2_BUCKET_NAME}.r2.dev`;
  if (!url.startsWith(base)) return null;
  return url.slice(base.length + 1);
}

/* -------------------------------------------------------------------------- */
/*  Download (server-side) — used for proxying if needed                       */
/* -------------------------------------------------------------------------- */

export async function getR2ObjectStream(key: string) {
  const client = getR2Client();
  const res = await client.send(
    new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key })
  );
  return res;
}
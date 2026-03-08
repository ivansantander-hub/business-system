import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID || "";
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || "";
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || "";
const BUCKET_NAME = process.env.R2_BUCKET_NAME || "business-system";
const ENDPOINT =
  process.env.R2_ENDPOINT ||
  `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`;

let _client: S3Client | null = null;

function getClient(): S3Client {
  _client ??= new S3Client({
      region: "auto",
      endpoint: ENDPOINT,
      credentials: {
        accessKeyId: ACCESS_KEY_ID,
        secretAccessKey: SECRET_ACCESS_KEY,
      },
  });
  return _client;
}

export function isR2Configured(): boolean {
  return Boolean(ACCESS_KEY_ID && SECRET_ACCESS_KEY && ACCOUNT_ID);
}

export async function uploadToR2(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string
): Promise<string> {
  const client = getClient();
  await client.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  return key;
}

export async function getFromR2(
  key: string
): Promise<{ body: ReadableStream | null; contentType: string } | null> {
  const client = getClient();
  try {
    const res = await client.send(
      new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key })
    );
    return {
      body: res.Body?.transformToWebStream() ?? null,
      contentType: res.ContentType || "application/octet-stream",
    };
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "name" in err &&
      (err as { name: string }).name === "NoSuchKey"
    ) {
      return null;
    }
    throw err;
  }
}

export async function getBufferFromR2(
  key: string
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const client = getClient();
  try {
    const res = await client.send(
      new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key })
    );
    const bytes = await res.Body?.transformToByteArray();
    if (!bytes) return null;
    return {
      buffer: Buffer.from(bytes),
      contentType: res.ContentType || "application/octet-stream",
    };
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "name" in err &&
      (err as { name: string }).name === "NoSuchKey"
    ) {
      return null;
    }
    throw err;
  }
}

export async function deleteFromR2(key: string): Promise<void> {
  const client = getClient();
  await client.send(
    new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: key })
  );
}

export async function existsInR2(key: string): Promise<boolean> {
  const client = getClient();
  try {
    await client.send(
      new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: key })
    );
    return true;
  } catch {
    return false;
  }
}

/** List objects by prefix */
export async function listR2(
  prefix: string,
  delimiter?: string,
  maxKeys = 1000
): Promise<{ prefixes: string[]; objects: { key: string; size: number; lastModified: Date | undefined }[] }> {
  const client = getClient();
  const res = await client.send(
    new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: prefix,
      Delimiter: delimiter,
      MaxKeys: maxKeys,
    })
  );
  return {
    prefixes: (res.CommonPrefixes || []).map((p) => p.Prefix || ""),
    objects: (res.Contents || []).map((o) => ({
      key: o.Key || "",
      size: o.Size || 0,
      lastModified: o.LastModified,
    })),
  };
}

/** Compute the R2 key for a sale invoice PDF */
export function invoicePdfKey(companyId: string, invoiceNumber: string): string {
  const safe = invoiceNumber.replaceAll(/[^a-zA-Z0-9_-]/g, "_");
  return `companies/${companyId}/invoices/${safe}.pdf`;
}

/** Compute the R2 key for a purchase order PDF */
export function purchasePdfKey(companyId: string, purchaseNumber: string): string {
  const safe = purchaseNumber.replaceAll(/[^a-zA-Z0-9_-]/g, "_");
  return `companies/${companyId}/purchases/${safe}.pdf`;
}

/** Compute the R2 key for a user avatar */
export function avatarKey(userId: string, ext: string): string {
  return `users/${userId}/avatar.${ext}`;
}

import sharp from "sharp";

import { db } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { slugifyFileName } from "@/lib/utils";

export async function uploadProjectReferenceAsset(input: {
  projectId: string;
  file: File;
  sortOrder: number;
}) {
  const env = getServerEnv();
  const admin = createSupabaseAdminClient();
  const safeName = slugifyFileName(input.file.name || "reference-image");
  const originalPath = `${input.projectId}/reference/${Date.now()}-${safeName}`;
  const bytes = Buffer.from(await input.file.arrayBuffer());

  const uploadOriginal = await admin.storage.from(env.STORAGE_BUCKET_RAW).upload(originalPath, bytes, {
    contentType: input.file.type,
    upsert: false
  });

  if (uploadOriginal.error) {
    throw new Error(uploadOriginal.error.message);
  }

  let previewPath: string | undefined;

  try {
    const previewBuffer = await sharp(bytes)
      .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    previewPath = `${input.projectId}/preview/${Date.now()}-${safeName}.webp`;

    const previewUpload = await admin.storage
      .from(env.STORAGE_BUCKET_RAW)
      .upload(previewPath, previewBuffer, {
        contentType: "image/webp",
        upsert: false
      });

    if (previewUpload.error) {
      previewPath = undefined;
    }
  } catch {
    previewPath = undefined;
  }

  return db.projectAsset.create({
    data: {
      projectId: input.projectId,
      origin: "ORIGINAL",
      storagePath: originalPath,
      previewPath,
      mimeType: input.file.type || "application/octet-stream",
      byteSize: input.file.size,
      fileName: input.file.name,
      sortOrder: input.sortOrder,
      expiresAt: new Date(Date.now() + env.ASSET_RETENTION_HOURS * 60 * 60 * 1000)
    }
  });
}

export async function signStoragePath(bucket: string, path?: string | null) {
  if (!path) {
    return null;
  }

  getServerEnv();
  const admin = createSupabaseAdminClient();
  const response = await admin.storage.from(bucket).createSignedUrl(path, 60 * 10);

  if (response.error) {
    return null;
  }

  return response.data.signedUrl;
}

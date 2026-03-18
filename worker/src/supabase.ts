import { createClient } from "@supabase/supabase-js";

import { workerEnv } from "./env.js";

const supabase = createClient(workerEnv.NEXT_PUBLIC_SUPABASE_URL, workerEnv.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export async function downloadStorageObject(bucket: string, path: string) {
  const response = await supabase.storage.from(bucket).download(path);
  if (response.error || !response.data) {
    throw new Error(response.error?.message ?? `Failed to download ${path}`);
  }

  const buffer = Buffer.from(await response.data.arrayBuffer());
  return {
    buffer,
    mimeType: response.data.type || "application/octet-stream"
  };
}

export async function uploadStorageObject(input: {
  bucket: string;
  path: string;
  buffer: Buffer;
  contentType: string;
}) {
  const response = await supabase.storage.from(input.bucket).upload(input.path, input.buffer, {
    contentType: input.contentType,
    upsert: true
  });

  if (response.error) {
    throw new Error(response.error.message);
  }

  return response.data.path;
}

export async function removeStorageObjects(bucket: string, paths: string[]) {
  if (paths.length === 0) {
    return;
  }

  const response = await supabase.storage.from(bucket).remove(paths);
  if (response.error) {
    throw new Error(response.error.message);
  }
}


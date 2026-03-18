import { z } from "zod";

const workerEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  LAOZHANG_API_KEY: z.string().min(1),
  LAOZHANG_BASE_URL: z.url().default("https://api.laozhang.ai"),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(10).default(2),
  WORKER_POLL_INTERVAL_MS: z.coerce.number().int().min(1000).default(5000),
  WORKER_CLEANUP_INTERVAL_MINUTES: z.coerce.number().int().min(5).default(30),
  ASSET_RETENTION_HOURS: z.coerce.number().int().min(1).default(24),
  STORAGE_BUCKET_RAW: z.string().default("product-raw"),
  STORAGE_BUCKET_GENERATED: z.string().default("product-generated"),
  STORAGE_BUCKET_VIDEO: z.string().default("product-video")
});

export const workerEnv = workerEnvSchema.parse(process.env);


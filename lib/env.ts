import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().default("Product Storyboard Studio")
});

const serverEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  LAOZHANG_API_KEY: z.string().min(1),
  LAOZHANG_BASE_URL: z.url().default("https://api.laozhang.ai"),
  APP_BASE_URL: z.url().default("http://localhost:3000"),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(10).default(2),
  WORKER_POLL_INTERVAL_MS: z.coerce.number().int().min(1000).default(5000),
  WORKER_CLEANUP_INTERVAL_MINUTES: z.coerce.number().int().min(5).default(30),
  ASSET_RETENTION_HOURS: z.coerce.number().int().min(1).default(24),
  STORAGE_BUCKET_RAW: z.string().default("product-raw"),
  STORAGE_BUCKET_GENERATED: z.string().default("product-generated"),
  STORAGE_BUCKET_VIDEO: z.string().default("product-video")
});

export const publicEnv = publicEnvSchema.parse({
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedServerEnv: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  if (cachedServerEnv) {
    return cachedServerEnv;
  }

  cachedServerEnv = serverEnvSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    DATABASE_URL: process.env.DATABASE_URL,
    LAOZHANG_API_KEY: process.env.LAOZHANG_API_KEY,
    LAOZHANG_BASE_URL: process.env.LAOZHANG_BASE_URL,
    APP_BASE_URL: process.env.APP_BASE_URL,
    WORKER_CONCURRENCY: process.env.WORKER_CONCURRENCY,
    WORKER_POLL_INTERVAL_MS: process.env.WORKER_POLL_INTERVAL_MS,
    WORKER_CLEANUP_INTERVAL_MINUTES: process.env.WORKER_CLEANUP_INTERVAL_MINUTES,
    ASSET_RETENTION_HOURS: process.env.ASSET_RETENTION_HOURS,
    STORAGE_BUCKET_RAW: process.env.STORAGE_BUCKET_RAW,
    STORAGE_BUCKET_GENERATED: process.env.STORAGE_BUCKET_GENERATED,
    STORAGE_BUCKET_VIDEO: process.env.STORAGE_BUCKET_VIDEO
  });

  return cachedServerEnv;
}

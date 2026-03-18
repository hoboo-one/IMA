# Product Storyboard Studio

Internal web workspace for turning product reference images into storyboard candidates, curated storyboard versions, and stitched product videos.

## Stack

- `Next.js 16` for the web workspace and API routes
- `Supabase` for auth, Postgres, and storage
- `Prisma` for relational app data
- `Railway` worker for async generation, polling, stitching, and cleanup
- `Veo 3.1` as the primary video model, with `Sora 2` as a test fallback

## Local Setup

1. Copy `.env.example` to `.env.local` and fill in the Supabase and LaoZhang values.
2. Install dependencies with `npm install`.
3. Generate Prisma client with `npm run db:generate`.
4. Start the web app with `npm run dev`.
5. Start the worker in a second terminal with `npm run worker:dev`.

## Important Notes

- The worker expects `ffmpeg` to be available in PATH. Railway uses the provided root `Dockerfile`.
- Assets and generated files are designed for 24-hour retention. The worker runs periodic cleanup.
- This repository is prepared for GitHub-driven deploys:
  - Connect the repo root to `Vercel` for the web app.
  - Connect the repo root to `Railway` using the root `Dockerfile` for the worker service.


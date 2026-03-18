# Product Storyboard Studio Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first production-ready monorepo scaffold for the internal product storyboard workspace, including auth, project data model, async job pipeline, and deployment configuration.

**Architecture:** Use a single Next.js app for the user-facing workspace and a separate Railway worker for async model orchestration. Persist app state in Supabase Postgres through Prisma and store raw/generated media in private Supabase Storage buckets.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.9, Supabase, Prisma 7, Railway worker, LaoZhang image/video APIs, FFmpeg

---

### Task 1: Repository Foundation

**Files:**
- Create: `.gitignore`
- Create: `.env.example`
- Create: `README.md`
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `eslint.config.mjs`

- [ ] Write root project metadata and environment placeholders.
- [ ] Configure scripts for web, Prisma, CI, and worker development.
- [ ] Add secure defaults such as CSP and private env handling.
- [ ] Verify TypeScript and Next.js root config resolve cleanly.

### Task 2: Database and Domain Model

**Files:**
- Create: `prisma/schema.prisma`
- Create: `shared/domain/*.ts`
- Create: `lib/db.ts`
- Create: `lib/env.ts`

- [ ] Model users, projects, assets, candidate batches, storyboard versions, video versions, jobs, and logs in Prisma.
- [ ] Define shared enums and input schemas with Zod.
- [ ] Add runtime environment validation and a shared Prisma client.
- [ ] Generate Prisma client and confirm schema compilation.

### Task 3: Auth and Secure Server Foundations

**Files:**
- Create: `lib/supabase/*.ts`
- Create: `lib/auth.ts`
- Create: `middleware.ts`
- Create: `app/(auth)/login/*`

- [ ] Implement Supabase SSR clients for browser, server, and admin operations.
- [ ] Protect dashboard routes and inactive accounts.
- [ ] Build a Chinese login experience and sign-out path.
- [ ] Ensure service-role usage remains server-side only.

### Task 4: Dashboard and Workspace UI

**Files:**
- Create: `app/(dashboard)/**/*`
- Create: `components/**/*`
- Create: `app/globals.css`

- [ ] Build the project list screen with search and status context.
- [ ] Build the project workspace with sections for reference images, candidate batches, storyboard versions, video runs, and activity logs.
- [ ] Add admin member management UI.
- [ ] Add client-side auto-refresh while jobs remain queued or running.

### Task 5: Business Actions and API Layer

**Files:**
- Create: `lib/projects.ts`
- Create: `lib/activity.ts`
- Create: `lib/jobs.ts`
- Create: `app/api/**/*`
- Create: `app/(dashboard)/**/actions.ts`

- [ ] Validate form input with shared schemas.
- [ ] Create server actions and route handlers for project creation, uploads, batch generation, storyboard curation, video generation, and member management.
- [ ] Persist human-readable activity logs.
- [ ] Enqueue worker jobs transactionally with related business records.

### Task 6: Worker and LaoZhang Integrations

**Files:**
- Create: `worker/**/*`
- Create: `Dockerfile`

- [ ] Build a polling worker with bounded concurrency.
- [ ] Implement LaoZhang image wrappers for Nano Banana2 and Nano Banana Pro.
- [ ] Implement LaoZhang video wrappers for Veo 3.1 async and Sora 2 async.
- [ ] Stitch completed segments with FFmpeg and upload final video outputs.
- [ ] Add retention cleanup for expired files and records.

### Task 7: Deployment and Validation

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `supabase/storage.sql`

- [ ] Add CI for Prisma generation, typecheck, and lint.
- [ ] Document Supabase storage bucket setup and policies.
- [ ] Run local validation commands after dependency installation.
- [ ] Prepare the repo for GitHub-driven Vercel and Railway deployment.


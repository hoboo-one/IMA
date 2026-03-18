# Product Storyboard Studio Design

## Summary

Build an internal desktop-first web workspace for a small team to upload up to three product reference images, generate storyboard candidates, curate editable storyboard versions, and turn those shots into stitched product videos.

## Product Decisions

- Internal tool with shared team workspace
- Manual account creation and fixed account import
- Roles: `admin`, `member`
- Projects are product-centric
- Assets and generated files expire after 24 hours, but the minimal project record remains
- Candidate image generation supports multiple rounds
- Formal storyboard versions are curated from candidate pools
- Storyboard shots can be lightly edited: title, notes, order, prompt, target duration
- Video generation is async
- `Veo 3.1` is the primary video model
- `Sora 2` remains available as a per-run test fallback
- Each video run is generated as per-shot segments and stitched into a final video
- Desktop web UI in Chinese

## Architecture

### Web

- `Next.js` app on Vercel for UI, authenticated pages, and server-side business actions
- Route protection and session refresh through Supabase SSR helpers
- Project list, workspace, and admin member screens

### Data

- `Supabase Auth` for user sign-in
- `Supabase Postgres` for app state via Prisma
- `Supabase Storage` private buckets for reference images, generated candidates, and videos

### Async Processing

- `Railway` Node worker polls queued jobs from Postgres
- Worker calls LaoZhang image and video APIs
- Worker downloads completed files, writes outputs to Storage, and updates app tables
- Worker runs retention cleanup every 30 minutes

## Core Data Model

- `UserProfile`
- `Project`
- `ProjectAsset`
- `ShotGenerationBatch`
- `ShotCandidate`
- `StoryboardVersion`
- `StoryboardShot`
- `VideoVersion`
- `VideoSegment`
- `JobRun`
- `ActivityLog`

## Integration Notes

- Candidate image generation defaults to Nano Banana2 and can use Nano Banana Pro for stronger edit/regeneration flows
- Veo 3.1 async accepts up to two images per request, so storyboard shots are transformed into individual segment jobs rather than sending the full storyboard at once
- Sora 2 async explicitly supports `10` and `15` second requests; Veo duration is treated as a target for stitching rather than a guaranteed model parameter

## Non-Functional Targets

- Authenticated pages should feel immediate after initial load
- Workspace updates should refresh automatically every 3-5 seconds while work is in progress
- Failure states must surface human-readable causes
- Secrets remain server-side only

## Open Integration Inputs

- Production tokens for Supabase, LaoZhang, Vercel, and Railway still need to be provided before deployment


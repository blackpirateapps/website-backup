# AI Handoff: website-backup

## Project Purpose

This is a small Next.js App Router dashboard for a manual website archiving pipeline.

- It displays historical snapshots hosted in a separate public repo (`blackpirateapps/archive-storage`).
- It triggers a GitHub Actions workflow in that same repo to create a new archive.
- It polls workflow status and shows step-level progress while the job runs.

The app itself does not generate archives. It is an operator UI + API proxy to GitHub.

## Stack and Runtime

- Framework: Next.js `16.1.6` (App Router)
- React: `19.2.3`
- TypeScript: strict mode enabled
- Node version: `.nvmrc` is `20`
- Linting: ESLint 9 with `eslint-config-next`

Key scripts (`package.json`):

- `npm run dev` - local dev server
- `npm run build` - production build
- `npm run start` - serve build
- `npm run lint` - lint project

## High-Level Architecture

### UI layer

- `app/page.tsx`
  - Main dashboard page.
  - Renders `TriggerButton`, `WorkflowStatus`, and `ArchiveList`.

- `components/TriggerButton.tsx`
  - Calls `POST /api/trigger` to dispatch the archive workflow.
  - Shows transient success/error/loading states.

- `components/WorkflowStatus.tsx`
  - Calls `GET /api/status`.
  - Auto-polls every 5s while workflow is `queued` or `in_progress`.
  - Hides completed runs older than 5 minutes.

- `components/ArchiveList.tsx`
  - Fetches snapshot index directly from GitHub Pages:
    - `https://blackpirateapps.github.io/archive-storage/index.json`
  - Renders card list with screenshot, date/time, and optional size.

### API layer (server routes)

- `app/api/trigger/route.ts`
  - Reads `process.env.GITHUB_PAT`.
  - Dispatches workflow `archive.yml` on `blackpirateapps/archive-storage` (`ref: main`).
  - Returns JSON success/error payload.

- `app/api/status/route.ts`
  - Reads `process.env.GITHUB_PAT`.
  - Fetches latest run for workflow `archive.yml`.
  - If run is active, fetches `jobs_url` and computes progress:
    - `current_step`
    - `completed_steps`
    - `total_steps`
  - Returns normalized run status fields.

### Styling

- `app/globals.css`
  - Global dark-themed UI styles and component classes.
  - Animation keyframes for pulse/spinner/fade.
  - Responsive layout adjustments under 640px.

## Data Contracts

### Archive index contract (external)

Consumed by `ArchiveList`:

```ts
interface Archive {
  id: string;
  date: string;
  screenshot: string;
  url: string;
  size_mb: number;
}

interface ArchiveIndex {
  archives: Archive[];
}
```

If this schema changes in `archive-storage/index.json`, UI rendering may break or degrade.

### Workflow status contract (internal API response)

Returned by `GET /api/status` and consumed by `WorkflowStatus`:

```ts
{
  status: string;          // queued | in_progress | completed | none | unknown
  conclusion: string|null; // success | failure | null
  started_at: string|null;
  updated_at: string|null;
  html_url: string|null;
  current_step: string;
  completed_steps: number;
  total_steps: number;
}
```

## Environment and Secrets

Required env var:

- `GITHUB_PAT`

Expected token capabilities:

- Read workflow runs/jobs for status endpoint
- Dispatch workflow runs for trigger endpoint

If missing, both API routes return `500` with a misconfiguration message.

## External Dependencies and Coupling

This app depends on external systems being stable:

- GitHub API shape and rate limits
- Repo `blackpirateapps/archive-storage`
- Workflow file name `archive.yml`
- Branch name `main`
- GitHub Pages index URL and schema

Any rename/move in external repo can break triggering, status polling, or archive listing.

## Current Behavior Notes

- `TriggerButton` always allows dispatch; there is no debounce/lock against repeated clicks after completion.
- `WorkflowStatus` silently ignores fetch errors.
- Status endpoint only inspects the first job in the run when computing step progress.
- Archive timestamps are rendered with `toLocaleDateString('en-US', { ...hour, minute })`.

## Known Risks / Technical Debt

- No tests present for API routes or UI components.
- No runtime validation for external JSON payloads.
- Hard-coded owner/repo/workflow constants in server routes.
- Error handling is user-friendly but not operationally rich (no logging/telemetry).
- `README.md` is still default `create-next-app` text and does not document real behavior.

## Suggested Next Improvements

1. Add `README.md` documentation for env setup, architecture, and operations.
2. Add runtime schema validation (`zod` or similar) for GitHub and archive index responses.
3. Add rate-limit aware/error-specific messaging for GitHub API failures.
4. Move repo/workflow identifiers to env vars for easier reuse.
5. Add tests:
   - API route unit/integration tests (mock GitHub API)
   - Component tests for status/trigger/archive states
6. Consider preventing double-trigger while an active run already exists.

## Approved Direction (Mar 2026)

The product direction is now approved to move from full snapshot storage to incremental, deduplicated storage while preserving existing archives.

- Keep all current legacy snapshots under `archives/<timestamp>/site/...` untouched.
- Introduce content-addressed storage for new snapshots.
- Use this app as the archive viewer for new snapshots (instead of directly browsing static files only).

### New Archive Model (Forward)

New snapshots in `archive-storage` should be written as:

- `objects/<prefix>/<sha256>` - immutable file blobs (store once)
- `snapshots/<timestamp>/manifest.json` - maps site path -> blob hash (+ metadata)
- `snapshots/<timestamp>/screenshot.png`
- `snapshots/<timestamp>/metadata.json`

Commit behavior target:

- Commit only newly created object blobs and new snapshot manifest/metadata/index deltas.
- Unchanged files should be referenced via hashes, not re-committed per snapshot.

### Compatibility Rules

- `index.json` remains the public listing source consumed by this UI.
- Legacy entries keep their existing `url` values pointing to `github.io/.../archives/...`.
- New entries should use viewer URLs on this app domain (for manifest/hash resolution).
- Mixed history (legacy + new CAS snapshots) must render in one timeline.

### Viewer Routing Requirements

Implement a resolver route in this app for new snapshots, e.g.:

- `/archive/<snapshotId>/...path`

Behavior:

- Load snapshot manifest for `<snapshotId>`.
- Resolve requested path to blob hash.
- Fetch blob bytes from `archive-storage` object store and stream response.
- Apply safe path normalization and traversal protection.
- Set correct content type and cache headers.

### Required Config

Add and use a canonical viewer base URL in the archive generation workflow:

- `ARCHIVE_VIEWER_BASE_URL` (example: `https://website-backup.vercel.app`)

This value should be used when generating `index.json` URLs for new snapshots.

### Rollout Plan

1. Update `archive-storage` workflow to produce CAS snapshots.
2. Add viewer route to this Next.js app for CAS snapshot serving.
3. Trigger and validate one new CAS snapshot end-to-end.
4. Confirm old archive URLs still work unchanged.
5. Optionally add a gradual migration tool for legacy snapshots later.

## Agent Onboarding Checklist

When a future agent starts work, do this first:

1. Read `app/page.tsx`, `components/*.tsx`, and `app/api/*/route.ts`.
2. Confirm `GITHUB_PAT` is configured in local/dev environment.
3. Run `npm run lint` and `npm run build` to baseline health.
4. Verify external assumptions:
   - `archive.yml` still exists in `blackpirateapps/archive-storage`
   - `index.json` is reachable and matches expected schema.

## File Map

- `app/layout.tsx` - metadata and root layout
- `app/page.tsx` - main dashboard composition
- `app/api/trigger/route.ts` - workflow dispatch endpoint
- `app/api/status/route.ts` - workflow status endpoint
- `components/TriggerButton.tsx` - trigger UI
- `components/WorkflowStatus.tsx` - status widget and polling logic
- `components/ArchiveList.tsx` - archive listing from GitHub Pages index
- `app/globals.css` - all global/page/component styling

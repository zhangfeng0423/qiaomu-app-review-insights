# Public trial deployment and recovery

This delivery targets `zhangfeng0423/qiaomu-app-review-insights`, branch
`codex/public-trial-delivery`. It does not release to the upstream author's site.
The dedicated Vercel project is `qiaomu-app-review-insights` in team
`zhangfeng0423s-projects`; dedicated Supabase project: `aycdtkpiuptagwhcvwrt`.

## Install and run

Use Node 22 and pnpm 10.15.1. Run `pnpm install --frozen-lockfile`, copy
`.env.example` to `.env.local`, and configure server-only credentials locally.
Run `pnpm dev`. Never commit `.env.local` or copy it into client code.

Required production configuration:

```env
APP_REVIEW_CACHE_BACKEND=supabase
APP_REVIEW_GENERATION_BACKEND=supabase
SUPABASE_URL=https://aycdtkpiuptagwhcvwrt.supabase.co
SUPABASE_SERVICE_ROLE_KEY=
QIAOMU_LLM_API_KEY=
QIAOMU_LLM_BASE_URL=
QIAOMU_LLM_MODEL=
QIAOMU_ADMIN_TOKEN=
NEXT_PUBLIC_SITE_URL=https://qiaomu-app-review-insights-delta.vercel.app
APP_REVIEW_PUBLIC_DAILY_NEW_APP_LIMIT=5
```

Supabase and LLM keys and the admin token must be Secret variables, scoped to
Production. Preview deployments intentionally do not receive production secrets.
All application writes use the server role; anonymous database access is revoked.
The legacy `STORAGE_TYPE` controls old management pages, not public reports.

## Migrate and import

Authenticate Supabase CLI, then run:

```sh
node scripts/supabase-delivery.mjs migrate
node scripts/supabase-delivery.mjs import
node scripts/verify-durable-jobs.mjs
```

The administrative scripts are explicitly pinned to the dedicated project above.
They use `SUPABASE_ACCESS_TOKEN`, or the CLI's macOS Keychain credential, without
logging it. For another project, review and change the target deliberately.
Migrations are repeatable and additive; imports compare JSON payloads and retain
the source files. A newer cloud report is never overwritten by an older import.
The job verifier cleans up only its own synthetic test rows, never reports.

The runtime uses normal Supabase REST, not the administrative Management API.
`GET /api/health` probes the report table and job RPC and must report
`database: connected` and `durable: true`. A dependency failure returns 503.
Do not disable TLS verification. On a machine whose network requires a proxy,
route this application's HTTPS traffic through a working, user-owned proxy;
proxy configuration is local infrastructure and is not deployed with the app.

## Generation and cost limits

The default daily limit is five task admissions per network identity, counting
review fetches and analyses, not merely distinct Apps. Clearing a browser cookie
does not reset the production quota. A shared network shares its quota.
Completed tasks of the same kind have a global 15-minute App cooldown; failed
attempts have a 30-second cooldown. The database serializes admissions and claims.

POST `/api/research` or `/api/research/regenerate` returns 202 with a job ID when
work is needed, or 200 for reusable cached results. Poll the returned status URL.
The browser retains the latest job ID and resumes on returning to the homepage.
Only a queued job can be claimed. A six-minute expired lease becomes interrupted;
running/interrupted AI work is never automatically replayed. A user may explicitly
retry after the cooldown; the retry may incur another model call. SDK automatic
retries are disabled. Model requests have a 120-second timeout.

Next.js `after()` performs the bounded execution after sending the response.
Polling can dispatch an unclaimed queued job, covering a crash before dispatch.
This is a persisted task with explicit interruption recovery, not a promise that
an unattended interrupted paid call will automatically be retried in background.

## Release checks

```sh
pnpm test
pnpm lint
pnpm check:hydration
pnpm build
pnpm exec tsc --noEmit
git diff --check
```

CI runs those checks without production credentials. Review the exact commit and
deploy it through the dedicated project's Git source. Verify the public homepage,
`/api/health`, a persisted report, read-only missing-report state, and 390px layout.
Record the deployment URL and commit in `DELIVERY_STATUS.md`.

## Rollback and incident handling

Record the last good deployment ID before promoting another release. Roll back
only this project's traffic using Vercel's deployment rollback, or redeploy its
last good commit. Keep the additive tables and report/history rows intact.
Do not drop tables or restore an old database snapshot for an application rollback.

To stop new work while investigating, set
`APP_REVIEW_PUBLIC_DAILY_NEW_APP_LIMIT=0` and redeploy. Existing reports remain
readable. Inspect structured job state and Vercel function errors, without dumping
credentials or full review corpora to logs. Interrupted tasks remain visible and
can be retried explicitly after resolving the cause. A failed health probe should
be treated as an incident, not bypassed by switching Serverless to local storage.

The public trial has no billing or account system. Legacy management and paid AI
helpers require the admin token; the public flow uses guarded research endpoints.

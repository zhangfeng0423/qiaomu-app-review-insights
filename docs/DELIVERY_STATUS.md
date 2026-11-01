# Public trial delivery status

Updated: 2026-11-01 (Asia/Shanghai). Target: the personal fork only.

## Release coordinates

- Repository: https://github.com/zhangfeng0423/qiaomu-app-review-insights
- Delivery branch: `codex/public-trial-delivery`
- PR: https://github.com/zhangfeng0423/qiaomu-app-review-insights/pull/1
- Public URL: https://qiaomu-app-review-insights-delta.vercel.app
- Vercel project: `prj_5jAnOgaLgOv0X9DDQB1IINvfDbCf`
- Supabase project: `aycdtkpiuptagwhcvwrt` (Seoul)
- Verified production deployment: `dpl_7Nh97w9FBp9z1CNEC1CbVEjt7c42`, commit `ee997de`.
- Final homepage canonical correction and additional failure tests await final deployment/CI verification.

## Requirement audit

- [x] Inspected repository instructions, scripts and existing changes; preserved user work on a dedicated branch.
- [x] Applied repeatable persistence and durable-job migrations with RLS and server-role grants.
- [x] Verified server REST access and denial of anonymous report SELECT and job admission RPC.
- [x] Imported six reports and five histories; compared every JSON payload and retained local originals.
- [x] Enabled Supabase runtime persistence for public reports, history, quotas and tasks.
- [x] Real database concurrency test: last-slot quota admission, cross-client App dedupe, single-worker claim, expiry and cooldown.
- [x] Persisted queued/running/completed/failed/interrupted jobs; queued work can be reclaimed after dispatch loss, running paid work is never automatically replayed.
- [x] Browser polling resumes the saved job ID after refresh; server logs show the same AI task ID before/after reload, without a second generation POST.
- [x] Strict Apple URL/region validation and candidate selection; reviewed error states and source boundaries.
- [x] Zero reviews, low sample with missing credentials, AI timeout, Apple failure, no matches and invalid input covered by isolated tests.
- [x] Real Apple fetch plus one real AI analysis completed with 160 Duolingo reviews and 18 insight points.
- [x] Restarted application and read the same completed task and report from Supabase.
- [x] Desktop (1440px) and mobile (390px) report evidence, charts, keyboard tabs and overflow checks; no browser warning/error logs.
- [x] Live production health, homepage, persisted report, missing-report state, discover, opportunities, robots and sitemap returned 200.
- [x] Live invalid input/URL/region returned 400, unknown job 404, legacy paid helpers 401, cached AI research 200 with cached=true.
- [x] Live Signal review-only task `1de8b9cd-0902-4ee8-a063-cc424cf3440e` completed through production after() execution and rendered in the mobile browser.
- [x] Health probes actual table/RPC connectivity and returns 503 on dependency failure.
- [x] CI, pinned pnpm lock/install, repeatable migration/import commands and deployment/rollback handbook included.
- [x] Changes pushed and personal-fork PR created; upstream repository and unrelated projects unchanged.
- [ ] Final revision CI and production deployment verified; PR marked ready and release coordinates finalized.

## Verification evidence

- Current local tests: 21 passed across seven files; TypeScript and diff checks passed.
- Previous complete check run: tests, lint, hydration, build, TypeScript and diff all passed.
- Clean Node 22 CI run 41263007671 passed every configured check; subsequent adapter-fix CI runs also passed.
- Lint retains nine existing legacy-screen warnings and no errors. No new lint rule suppression was introduced.
- Build tracing warnings fixed by explicit runtime cache access annotations.
- Initial Vercel failure was Next 16.3 standalone/adapter ENOENT (vercel/next.js#96646).
  Conditional platform output fixed it; Docker retains standalone.
- Runtime restart check returned completed Duolingo job, reviews=160, AI summary present, health connected.
- 390px trend view: document scrollWidth=390, five chart canvases, no browser warn/error logs.
- 1440px report: scrollWidth=1440; evidence heading visible; Home key selected first report tab.
- Live health: ok=true, database=connected, cacheBackend=supabase, generationBackend=supabase, durable=true.
- Dedicated real-DB verifier: `node scripts/verify-durable-jobs.mjs` passed without model calls and cleaned only its own synthetic fixtures.

## Operating limits and handoff

See [DEPLOYMENT.md](DEPLOYMENT.md) for setup, migration, execution semantics, secret scopes, release and rollback.

- Daily quota defaults to five task admissions per network identity (review fetches and analyses count), plus App cooldowns.
- Interrupted work needs an explicit retry; retry may make another paid call. There is no promise of unattended automatic replay.
- Production secrets are server-only and scoped to this project's Production environment; preview builds do not receive them.
- Local direct Supabase TLS failed because the machine's fallback proxy rule used DIRECT.
  An isolated proxy using existing user egress proved the cause and enabled local verification without changing system settings or disabling TLS.
  Vercel production connects directly and health is verified.
- No automatic PR merge, paid plan upgrade, domain ownership change or business-data deletion was performed.

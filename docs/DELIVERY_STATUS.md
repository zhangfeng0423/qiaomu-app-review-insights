# Delivery status

Goal: deliver the public trial with durable reports and jobs, verified quotas,
runtime evidence, a personal-fork PR, and a verified deployment.

## Verified during delivery audit

- Supabase CLI authenticated; project `aycdtkpiuptagwhcvwrt` is ACTIVE_HEALTHY.
- Personal GitHub account: `zhangfeng0423`; target remote: `fork`.
- Preserve all existing working-tree changes. No applicable AGENTS.md found.
- Supabase REST from this machine currently fails TLS; system DNS returns a
  Mihomo fake IP. A real-IP resolution attempt also failed. Investigating proxy.
- Vercel team `team_kqlekZiAyF0tQem2laieJB8h` has 12 projects; none is named
  qiaomu-app-review-insights. Repository bindings still need inspection.
- Delivery branch: `codex/public-trial-delivery`.
- `node scripts/supabase-delivery.mjs migrate`: succeeded against the dedicated
  project. Four tables verified with RLS, no anon SELECT privilege, server INSERT.
- `node scripts/supabase-delivery.mjs import`: six reports imported; each JSONB
  payload compared equal to the local original. History import added subsequently.
- `pnpm test`: 11 passed; `pnpm exec tsc --noEmit` and `git diff --check`: passed
  after the history adapter change. These do not yet verify durable generation.
- Management API works with CLI credentials; REST TLS fails with system DNS,
  explicit real IP, HTTP proxy and SOCKS proxy. Keep local mode until runtime
  connectivity is proven. Do not disable TLS verification.
- Five histories imported and JSONB-compared successfully; originals retained.
- Migration `202610310002_durable_jobs.sql` applied. New admissions use advisory
  locks for IP quotas and App jobs, single-worker claims, leases and explicit
  interrupted states; anonymous roles cannot invoke admission/claim/status RPCs.
- `node scripts/verify-durable-jobs.mjs`: passed against the real database:
  concurrent last-slot reservation, cross-client dedupe, simultaneous worker
  claims, expired lease, rejection of automatic replay, and retry cooldown.
  Only synthetic rows for that invocation are removed after testing.
- Supabase-mode routes now accept persisted jobs with HTTP 202, execute after
  response through Next.js after(), and expose a no-store status endpoint.
  Polling can restart queued execution via the atomic claim; interrupted running
  jobs require an explicit retry rather than automatic potentially paid replay.
- Home, chart generation and report refresh share async polling; the latest job
  ID is retained locally for home-page recovery. SDK retries disabled and LLM
  request timeout set to 120 seconds to avoid implicit paid request duplication.
- Legacy AI GET endpoints and translation now require the existing admin boundary.
- Current unit tests: 13 passed; TypeScript passed. Real DB job assertions pass;
  end-to-end app execution over REST and browser recovery are still unverified.
- Latest completed production build (including job routes and browser transport)
  passed. Lint is back to the 9 pre-existing warnings; hydration scan passed.
- Health endpoint now probes the report table and job RPC with five-second
  deadlines and responds 503 on dependency failure. Docker explicitly declares
  its mounted persistent volume; local mode no longer implies durability.
- Personal fork has no GitHub deployments. Vercel CLI lacks local credentials;
  connected Vercel tools can inspect the user's team. Existing deployment binding
  discovery remains open (do not use the upstream homepage as the user's target).

## Required work (not yet delivered)

Latest runtime evidence:

- Supabase REST failure was caused by the machine's proxy routing (the fallback
  selected DIRECT). An isolated proxy process using the user's existing egress
  connected successfully without changing system proxy selection or disabling TLS.
- Runtime server read reports=6/histories=5; anonymous REST report SELECT and job
  reservation RPC were both denied. Local Supabase mode now enabled.
- `/api/health` returned 200, database connected and durable true.
- Real Apple RSS fetched 160 Duolingo samples; one real AI task completed without
  aiError. Task `700abe17-7114-4638-8579-78b0d2b32bd3` is completed; report path
  `/apps/us/570060128/duolingo-learn-languages`. A homepage reload polled the same
  task ID, without a second generation POST (server logs).
- In-app browser displayed the real AI summary, 18 insight points and original
  evidence. At 390px, trend tab has five charts, document scrollWidth=390, no
  browser warn/error logs. Report evidence and desktop acceptance still pending.
- Created dedicated Vercel project `prj_5jAnOgaLgOv0X9DDQB1IINvfDbCf` bound to
  the personal fork. Node 22, pnpm frozen install, production-only server secrets
  configured. Existing unrelated projects were not altered. No deployment yet.
- Current unit tests: 15 passed (including strict URL/region input tests).
- Delivery commit `bc70836` pushed; personal fork PR #1 created as draft.
- GitHub CI run 41263007671 passed every check on Node 22 from a clean checkout.
- Restart durability verified: a new app process returned the same completed
  Duolingo task, 160 reviews, and AI summary from Supabase; health remained connected.
- Initial Vercel deployment failed at adapter packaging: Next 16.3 standalone
  ENOENT for next-server.js.nft.json (upstream issue vercel/next.js#96646).
  Vercel now uses adapter output; Docker keeps standalone.
- Verified primary project domain: qiaomu-app-review-insights-delta.vercel.app.
  Production canonical URL configuration corrected to this assigned domain.

- [ ] Verify/apply repeatable migrations and RLS; real server read/write and anonymous isolation.
- [ ] Import existing reports and histories, verify contents, enable persistence.
- [ ] Replace read/modify/write quotas with atomic reservations.
- [ ] Replace process-only deduplication with persistent jobs, leases and recovery.
- [ ] Verify all public AI entry points and input/error states.
- [ ] Real Apple fetch and one real AI generation; restart durability.
- [ ] Desktop/mobile browser acceptance and meaningful regression tests.
- [ ] Honest dependency health checks, CI, install/deploy/rollback instructions.
- [ ] Personal fork delivery branch, reviewed commit, push and PR.
- [ ] Confirm owned deployment target, deploy and verify online.

## Evidence policy

Historical test/build claims are not acceptance evidence for the delivery changes.
Record fresh results and exact commands here. Do not record keys, tokens or
credential-bearing URLs. The goal remains active while any required item is open.

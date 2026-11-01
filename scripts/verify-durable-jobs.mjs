import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { query } from './lib/supabase-management.mjs';

// Synthetic job rows are isolated by a per-run identifier and removed in finally.
// This tool never calls Apple or an LLM, or modifies report/history payloads.
const ip = `delivery-test:${randomUUID()}`;
const base = String(Date.now());
const app = `us-${base}`;
async function reserve(key, identity = ip, limit = 1) {
  const rows = await query('SELECT public.reserve_review_job($1,$2,$3,$4::jsonb,$5,$6) AS result',
    [key,'analysis',identity,'{}',limit,900]);
  return rows[0].result;
}
try {
  const quota = await Promise.all([reserve(app), reserve(`us-${base}1`)]);
  assert.equal(quota.filter(x => x.status === 'created').length, 1, 'Concurrent IP quota admission must be atomic');
  assert.equal(quota.filter(x => x.status === 'limited').length, 1);
  const admitted = quota.find(x => x.status === 'created');
  const [{ app_key: appKey }] = await query('SELECT app_key FROM public.app_review_jobs WHERE id=$1::uuid', [admitted.jobId]);
  const duplicate = await reserve(appKey, `${ip}:other-ip`);
  assert.equal(duplicate.status, 'existing', 'Different clients must share the active App job');
  assert.equal(duplicate.jobId, admitted.jobId);

  const claims = await Promise.all([randomUUID(),randomUUID()].map(token => query(
    'SELECT public.claim_review_job($1::uuid,$2::uuid) AS result', [admitted.jobId,token])));
  assert.equal(claims.filter(rows => rows[0].result).length, 1, 'Only one worker may claim execution');
  await query("UPDATE public.app_review_jobs SET lease_until=now()-interval '1 second' WHERE id=$1::uuid", [admitted.jobId]);
  const [expired] = await query('SELECT public.read_review_job($1::uuid) AS result',[admitted.jobId]);
  assert.equal(expired.result.status,'interrupted','Expired work must become recoverable, not stay running');
  const [reclaim] = await query('SELECT public.claim_review_job($1::uuid,$2::uuid) AS result',[admitted.jobId,randomUUID()]);
  assert.equal(reclaim.result,null,'Interrupted work must not automatically repeat a potentially paid call');
  const cooldown = await reserve(appKey);
  assert.equal(cooldown.status,'cooldown');
  console.log('PASS: concurrent quota, cross-client deduplication, single-worker claim, timeout state, no automatic replay, cooldown.');
} finally {
  await query('DELETE FROM public.app_review_jobs WHERE ip_key=$1', [ip]);
}

import { NextResponse } from 'next/server';
import { getServerSupabase, shouldUseSupabaseGenerationGuard } from '@/lib/server/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const serverless = process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME;
  const cacheBackend = process.env.APP_REVIEW_CACHE_BACKEND || 'local';
  const generationBackend = shouldUseSupabaseGenerationGuard() ? 'supabase' : 'local';
  let connected = cacheBackend !== 'supabase' && generationBackend !== 'supabase';
  let databaseStatus = connected ? 'local-mode' : 'unavailable';
  if (!connected) {
    try {
      const client = getServerSupabase();
      const [pages, jobs] = await Promise.all([
        client.from('app_review_pages').select('cache_key').limit(1).abortSignal(AbortSignal.timeout(5000)),
        client.rpc('read_review_job',{p_id:'00000000-0000-0000-0000-000000000000'}).abortSignal(AbortSignal.timeout(5000)),
      ]);
      connected = !pages.error && !jobs.error;
      databaseStatus = connected ? 'connected' : 'unavailable';
    } catch {
      databaseStatus = 'unavailable';
    }
  }
  const warnings = [
    serverless && cacheBackend !== 'supabase'
      ? 'Serverless 环境仍使用本地洞察缓存，实例回收后数据可能丢失。'
      : null,
    serverless && generationBackend !== 'supabase'
      ? 'Serverless 环境仍使用本地生成限流，额度可能无法跨实例保持。'
      : null,
  ].filter((item): item is string => Boolean(item));

  return NextResponse.json({
    ok: connected,
    service: 'appreview.qiaomu.ai',
    model: process.env.QIAOMU_LLM_MODEL || process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash',
    persistence: {
      cacheBackend,
      generationBackend,
      durable: connected && ((cacheBackend === 'supabase' && generationBackend === 'supabase')
        || (!serverless && process.env.APP_REVIEW_LOCAL_PERSISTENT === 'true')),
    },
    dependencies: {database:databaseStatus},
    warnings,
    time: new Date().toISOString(),
  }, {status:connected ? 200 : 503,headers:{'Cache-Control':'no-store'}});
}

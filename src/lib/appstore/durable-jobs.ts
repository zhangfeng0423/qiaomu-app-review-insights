import 'server-only';
import { createHmac, randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { generateCachedReviewPage } from '@/lib/appstore/cache';
import { getServerSupabase } from '@/lib/server/supabase';
import type { AppResolution } from '@/lib/appstore/discovery';

export interface JobInput {
  appId: string;
  country: string;
  maxReviews: number;
  analyze: boolean;
  force?: boolean;
  incremental?: boolean;
  resolution?: AppResolution;
}
export interface PublicJob {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'interrupted';
  pagePath?: string;
  error?: string;
}
type Admission = {
  status: 'created' | 'existing' | 'limited' | 'cooldown';
  jobId?: string;
  retryAfterSeconds?: number;
  resetAt?: string;
};

function quotaIdentity(request: NextRequest) {
  // IP quota is independent of client-supplied cookies. Only trust proxy headers
  // from the deployment ingress; local mode shares an explicit unknown bucket.
  const ip = (process.env.VERCEL === '1'
    ? request.headers.get('x-vercel-forwarded-for') || request.headers.get('x-forwarded-for')
    : request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for'))
    ?.split(',')[0]?.trim() || 'unknown';
  const secret = process.env.QIAOMU_ADMIN_TOKEN || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error('公开生成服务尚未完成服务端配置');
  return createHmac('sha256',secret).update(`quota:${ip}`).digest('hex');
}

export async function reserveDurableJob(request: NextRequest, input: JobInput): Promise<Admission> {
  const parsedLimit = Number.parseInt(process.env.APP_REVIEW_PUBLIC_DAILY_NEW_APP_LIMIT || '5',10);
  const {data,error} = await getServerSupabase().rpc('reserve_review_job', {
    p_app_key: `${input.country}-${input.appId}`,
    p_kind: input.analyze ? 'analysis' : 'reviews',
    p_ip_key: quotaIdentity(request), p_input: input,
    p_daily_limit: Number.isFinite(parsedLimit) ? Math.max(0,parsedLimit) : 5,
    p_cooldown_seconds: 900,
  });
  if (error) throw new Error('暂时无法登记生成任务，请稍后重试');
  return data as Admission;
}

export async function readDurableJob(id: string): Promise<PublicJob | null> {
  const {data,error} = await getServerSupabase().rpc('read_review_job',{p_id:id});
  if (error) throw new Error('暂时无法读取生成进度，请稍后重试');
  return data as PublicJob | null;
}

export async function executeDurableJob(id: string) {
  const client = getServerSupabase();
  const token = randomUUID();
  const {data,error} = await client.rpc('claim_review_job',{p_id:id,p_token:token});
  if (error) throw new Error('Unable to claim persisted generation job');
  if (!data) return; // Another server already claimed it, or its lease expired.
  let status: PublicJob['status'] = 'completed';
  let pagePath: string | undefined;
  let message: string | undefined;
  try {
    const result = await generateCachedReviewPage(data.input as JobInput);
    pagePath = result.page.pagePath;
    if (result.page.aiError) {
      status = 'failed';
      message = '评论已保存，AI 研判未完成。请稍后重试。';
    }
  } catch {
    status = 'failed';
    message = '生成未完成，已有报告保持可用。请稍后重试。';
  }
  const finished = await client.from('app_review_jobs').update({
    status, page_path:pagePath, error:message, finished_at:new Date().toISOString(),
  }).eq('id',id).eq('worker_token',token).eq('status','running');
  if (finished.error) throw new Error('Unable to persist generation job result');
}

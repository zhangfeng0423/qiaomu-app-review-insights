import { NextRequest, NextResponse } from 'next/server';
import { generateCachedReviewPage } from '@/lib/appstore/cache';
import { normalizeCountry, validateResearchInput } from '@/lib/appstore/discovery';
import { appGenerationKey, runGuardedPublicRefresh, setGenerationCookie } from '@/lib/appstore/generation-guard';
import { shouldUseSupabaseGenerationGuard } from '@/lib/server/supabase';
import { durableJobResponse } from '@/lib/appstore/job-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

interface RegenerateRequest {
  appId?: string;
  country?: string;
  maxReviews?: number;
  analyze?: boolean;
  incremental?: boolean;
}

function clampReviewLimit(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed)) return 160;
  return Math.min(Math.max(parsed, 20), 400);
}

function safeErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return '未知错误';
  if (/api[_-]?key|authorization|secret|token/i.test(error.message)) {
    return 'AI 服务密钥未配置或不可用';
  }
  return error.message;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as RegenerateRequest;
    const appId = String(body.appId || '').trim();
    validateResearchInput(appId,body.country);

    if (!/^\d+$/.test(appId)) {
      return setGenerationCookie(NextResponse.json({ success: false, error: '缺少有效 App ID' }, { status: 400 }), request);
    }

    const allowPublicFullRegenerate = process.env.APP_REVIEW_ALLOW_PUBLIC_FORCE === 'true';
    const incremental = allowPublicFullRegenerate ? body.incremental !== false : true;
    const country = normalizeCountry(body.country);
    if (shouldUseSupabaseGenerationGuard()) {
      return await durableJobResponse(request, {
        appId, country, maxReviews:clampReviewLimit(body.maxReviews),
        analyze:body.analyze !== false, force:!incremental, incremental,
      });
    }
    const generation = await runGuardedPublicRefresh({
      request,
      appKey: appGenerationKey(country, appId),
      generate: () => generateCachedReviewPage({
        appId,
        country,
        maxReviews: clampReviewLimit(body.maxReviews),
        analyze: body.analyze !== false,
        force: !incremental,
        incremental,
      }),
    });

    if (generation.status === 'rate-limited') {
      return setGenerationCookie(NextResponse.json(
        { success: false, error: `这个 App 最近已经更新过，请 ${generation.retryAfterSeconds} 秒后再试。` },
        {
          status: 429,
          headers: { 'Retry-After': String(generation.retryAfterSeconds) },
        }
      ), request);
    }

    const { page, cached } = generation.result;

    return setGenerationCookie(NextResponse.json({
      success: true,
      data: {
        pageUrl: page.pagePath,
        updatedAt: page.updatedAt,
        cached,
        incremental,
      },
    }), request);
  } catch (error) {
    console.error('Regenerate request failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: safeErrorMessage(error),
      },
      { status: /请输入|无效 App|不支持/.test(safeErrorMessage(error)) ? 400 : 502 }
    );
  }
}

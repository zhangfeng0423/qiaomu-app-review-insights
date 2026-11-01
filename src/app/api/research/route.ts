import { NextRequest, NextResponse } from 'next/server';
import { ReviewMiningResponse } from '@/lib/analysis/kimi-client';
import {
  CachedAppReviewPage,
  ReviewSourceBreakdown,
  generateCachedReviewPage,
  hasMeaningfulInsights,
  readCachedReviewPage,
  resolveAppForCache,
} from '@/lib/appstore/cache';
import { ReviewDiagnostics } from '@/lib/appstore/diagnostics';
import {
  GenerationLimitInfo,
  appGenerationKey,
  isFreshCachedPage,
  publicCacheFreshDays,
  runGuardedPublicGeneration,
  setGenerationCookie,
} from '@/lib/appstore/generation-guard';
import { normalizeCountry, validateResearchInput, AppStoreLookupResult } from '@/lib/appstore/discovery';
import { ReviewStats } from '@/lib/appstore/review-summary';
import { AppStoreReview } from '@/types';
import { shouldUseSupabaseGenerationGuard } from '@/lib/server/supabase';
import { durableJobResponse } from '@/lib/appstore/job-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

interface ResearchRequest {
  query?: string;
  country?: string;
  maxReviews?: number;
  analyze?: boolean;
  force?: boolean;
}

interface ResearchResponse {
  app: AppStoreLookupResult;
  candidates: AppStoreLookupResult[];
  source: 'url' | 'id' | 'search';
  stats: ReviewStats;
  reviews: AppStoreReview[];
  sourceBreakdown?: ReviewSourceBreakdown;
  diagnostics?: ReviewDiagnostics;
  insights: ReviewMiningResponse | null;
  aiError?: string;
  pageUrl: string;
  updatedAt: string;
  cached: boolean;
  generation?: {
    status: 'cached' | 'generated' | 'deduped' | 'queued';
    message?: string;
    limit?: GenerationLimitInfo;
  };
  model?: {
    provider: string;
    model: string;
  };
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

function isClientInputError(message: string) {
  return /请输入|没有找到|没有在 .* 区找到|无效 App|不支持|输入内容过长/.test(message);
}

function resetTimeLabel(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '明天 UTC 00:00';
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Shanghai',
  }).format(date);
}

function resetAfterSeconds(value: string) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return 3600;
  return Math.max(1, Math.ceil((timestamp - Date.now()) / 1000));
}

export function shouldGeneratePage(page: CachedAppReviewPage | null, options: {
  force: boolean;
  freshDays: number;
  analyze: boolean;
}) {
  if (!page) return true;
  if (options.force) return true;
  if (options.analyze && (!hasMeaningfulInsights(page.insights) || Boolean(page.aiError))) return true;
  if (isFreshCachedPage(page, options.freshDays)) return false;
  return true;
}

function researchResponse(
  page: CachedAppReviewPage,
  cached: boolean,
  generation?: ResearchResponse['generation']
): ResearchResponse {
  return {
    app: page.app,
    candidates: page.candidates,
    source: page.source,
    stats: page.stats,
    reviews: page.reviews,
    sourceBreakdown: page.sourceBreakdown,
    diagnostics: page.diagnostics,
    insights: page.insights,
    aiError: page.aiError,
    pageUrl: page.pagePath,
    updatedAt: page.updatedAt,
    cached,
    generation,
    model: page.model,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as ResearchRequest;
    const query = String(body.query || '').trim();
    validateResearchInput(query,body.country);
    if (!query) {
      return setGenerationCookie(
        NextResponse.json({ success: false, error: '请输入 App 名称、App Store 链接或 App ID' }, { status: 400 }),
        request
      );
    }
    const country = normalizeCountry(body.country);
    const maxReviews = clampReviewLimit(body.maxReviews);
    const shouldAnalyze = body.analyze !== false;
    const publicForceEnabled = process.env.APP_REVIEW_ALLOW_PUBLIC_FORCE === 'true';
    const force = publicForceEnabled && body.force === true;
    const freshDays = publicCacheFreshDays();
    const resolution = await resolveAppForCache({ query, country });
    const resolvedCountry = normalizeCountry(resolution.app.country);
    const existing = await readCachedReviewPage(resolvedCountry, resolution.app.id);

    if (!shouldGeneratePage(existing, { force, freshDays, analyze: shouldAnalyze })) {
      return setGenerationCookie(NextResponse.json({
        success: true,
        data: researchResponse({...existing!,candidates:resolution.candidates,source:resolution.source}, true, {
          status: 'cached',
        }),
      }), request);
    }

    const appKey = appGenerationKey(resolvedCountry, resolution.app.id);
    if (shouldUseSupabaseGenerationGuard()) {
      return await durableJobResponse(request, {
        appId:resolution.app.id, country:resolvedCountry, maxReviews, analyze:shouldAnalyze,
        resolution,
        force:force || Boolean(existing && !isFreshCachedPage(existing,freshDays)),
      });
    }
    const generation = await runGuardedPublicGeneration({
      request,
      appKey,
      queue: {
        appKey,
        appId: resolution.app.id,
        appName: resolution.app.name,
        country: resolvedCountry,
        query,
        reason: 'rate-limited',
      },
      generate: () => generateCachedReviewPage({
        query,
        country: resolvedCountry,
        maxReviews,
        analyze: shouldAnalyze,
        force: force || Boolean(existing && !isFreshCachedPage(existing, freshDays)),
        resolution,
      }),
    });

    if (generation.status === 'queued') {
      const message = existing
        ? `今天的新 App 生成次数已用完，当前报告保持不变。额度将在 ${resetTimeLabel(generation.limit.resetAt)} 重置。`
        : `今天的新 App 生成次数已用完，本次没有开始抓取。额度将在 ${resetTimeLabel(generation.limit.resetAt)} 重置后再试。`;

      if (existing) {
        return setGenerationCookie(NextResponse.json({
          success: true,
          data: researchResponse(existing, true, {
            status: 'queued',
            message,
            limit: generation.limit,
          }),
        }), request);
      }

      return setGenerationCookie(NextResponse.json(
        { success: false, error: message },
        { status: 429, headers: { 'Retry-After': String(resetAfterSeconds(generation.limit.resetAt)) } }
      ), request);
    }

    const { page, cached } = generation.result;

    return setGenerationCookie(NextResponse.json({
      success: true,
      data: researchResponse(page, cached, {
        status: cached ? 'cached' : generation.status,
      }),
    }), request);
  } catch (error) {
    console.error('Research request failed:', error);
    const message = safeErrorMessage(error);
    return setGenerationCookie(NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: isClientInputError(message) ? 400 : 502 }
    ), request);
  }
}

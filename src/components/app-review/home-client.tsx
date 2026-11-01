'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { PENDING_RESEARCH_KEY, requestResearch, resumeResearchJob } from '@/lib/research-request';
import Image from 'next/image';
import Link from 'next/link';
import {
  AlertCircle,
  Apple,
  ArrowUpRight,
  CheckCircle2,
  ChevronsUpDown,
  Compass,
  Loader2,
  Search,
  Sparkles,
  Star,
  X,
} from 'lucide-react';
import { InsightGrid } from '@/components/app-review/insight-cards';
import { BrandMark, SiteAffordances } from '@/components/app-review/site-footer';
import {
  ReviewSourceBreakdown,
  ReviewSourceBreakdownPanel,
  reviewSourceLabel,
} from '@/components/app-review/source-breakdown';
import { AppStoreReview } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Priority = 'high' | 'medium' | 'low';

interface AppStoreLookupResult {
  id: string;
  name: string;
  country: string;
  artistName: string;
  artworkUrl: string;
  trackViewUrl: string;
  averageUserRating?: number;
  userRatingCount?: number;
  primaryGenreName?: string;
  version?: string;
  currentVersionReleaseDate?: string;
}

interface ReviewStats {
  totalReviews: number;
  averageRating: number;
  ratingDistribution: Record<string, number>;
  versionDistribution: Array<{ version: string; count: number; averageRating: number }>;
  latestReviewDate?: string;
  oldestReviewDate?: string;
  negativeShare: number;
  positiveShare: number;
}

interface ReviewMiningItem {
  title: string;
  summary: string;
  evidence?: string;
  priority?: Priority;
}

interface ReviewMiningResponse {
  executiveSummary: string;
  painPoints: ReviewMiningItem[];
  opportunities: ReviewMiningItem[];
  positiveSignals: ReviewMiningItem[];
  userSegments: ReviewMiningItem[];
  versionRisks: ReviewMiningItem[];
  actionPlan: ReviewMiningItem[];
  queryAngles: string[];
  model: string;
  generatedAt: string;
}

interface ResearchData {
  app: AppStoreLookupResult;
  candidates: AppStoreLookupResult[];
  source: 'url' | 'id' | 'search';
  stats: ReviewStats;
  reviews: AppStoreReview[];
  sourceBreakdown?: ReviewSourceBreakdown;
  insights: ReviewMiningResponse | null;
  aiError?: string;
  pageUrl: string;
  updatedAt: string;
  cached: boolean;
  generation?: {
    status: 'cached' | 'generated' | 'deduped' | 'queued';
    message?: string;
    limit?: {
      limit: number;
      used: number;
      remaining: number;
      resetAt: string;
    };
  };
  model?: {
    provider: string;
    model: string;
  };
}

interface FeaturedAppSummary {
  id: string;
  name: string;
  country: string;
  artistName: string;
  artworkUrl: string;
  pagePath: string;
  updatedAt: string;
  averageRating: number;
  totalReviews: number;
  negativeShare: number;
  positiveShare: number;
  primaryGenreName?: string;
}

const countryOptions = [
  { value: 'cn', label: '中国' },
  { value: 'us', label: '美国' },
  { value: 'jp', label: '日本' },
  { value: 'gb', label: '英国' },
  { value: 'de', label: '德国' },
  { value: 'fr', label: '法国' },
  { value: 'kr', label: '韩国' },
  { value: 'hk', label: '香港' },
  { value: 'tw', label: '台湾' },
];

const CACHED_APP_PAGE_SIZE = 12;

function formatDate(value?: string) {
  if (!value) return '未知';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '未知';
  return new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric' }).format(date);
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatFullDate(value?: string) {
  if (!value) return '未知';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '未知';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function ratingCount(stats: ReviewStats, rating: number) {
  return stats.ratingDistribution[String(rating)] || 0;
}

function maxRatingBucket(stats: ReviewStats) {
  return Math.max(1, ...[1, 2, 3, 4, 5].map((rating) => ratingCount(stats, rating)));
}

function hasMeaningfulClientInsights(insights: ReviewMiningResponse | null | undefined) {
  if (!insights) return false;
  const summary = String(insights.executiveSummary || '').trim();
  const hasDefaultSummary = /暂无足够评论|暂无明显信号|暂未生成/.test(summary);
  const hasItems = [
    insights.painPoints,
    insights.opportunities,
    insights.positiveSignals,
    insights.userSegments,
    insights.versionRisks,
    insights.actionPlan,
  ].some((items) => Array.isArray(items) && items.length > 0);

  return Boolean(summary && !hasDefaultSummary && hasItems);
}

function AppIcon({ app }: { app: AppStoreLookupResult }) {
  if (!app.artworkUrl) {
    return (
      <div className="grid h-16 w-16 place-items-center rounded-lg bg-zinc-900 text-white">
        <Apple className="h-8 w-8" />
      </div>
    );
  }

  return (
    <Image
      src={app.artworkUrl}
      alt={`${app.name} icon`}
      width={64}
      height={64}
      unoptimized
      className="h-16 w-16 rounded-lg border border-zinc-200 bg-white object-cover shadow-sm"
    />
  );
}

function clampPage(page: number, totalPages: number) {
  return Math.min(Math.max(page, 1), Math.max(totalPages, 1));
}

function pageHref(page: number) {
  return page <= 1 ? '/#cached-apps' : `/?cachePage=${page}#cached-apps`;
}

function FeaturedApps({ apps, currentPage }: { apps: FeaturedAppSummary[]; currentPage: number }) {
  if (apps.length === 0) return null;
  const totalPages = Math.ceil(apps.length / CACHED_APP_PAGE_SIZE);
  const page = clampPage(currentPage, totalPages);
  const pageApps = apps.slice((page - 1) * CACHED_APP_PAGE_SIZE, page * CACHED_APP_PAGE_SIZE);
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1)
    .filter((item) => item === 1 || item === totalPages || Math.abs(item - page) <= 1);

  return (
    <section id="cached-apps" className="mx-auto max-w-7xl scroll-mt-6 px-4 pt-10 pb-16 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-zinc-950">已收录的 App 洞察研判</h2>
        <p className="mt-1 text-sm text-zinc-600">点击任意 App 卡片即可直达深度分析报告，支持多版本走势与差评证据核对。</p>
        </div>
        <span className="rounded-full border border-zinc-200 bg-white px-3.5 py-1 text-xs font-semibold text-zinc-600 shadow-xs">
          共 {apps.length} 个应用 · 第 {page}/{totalPages} 页
        </span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pageApps.map((app) => (
          <Link
            key={`${app.country}-${app.id}`}
            href={app.pagePath}
            className="group relative flex min-w-0 flex-col justify-between rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-teal-500/50 hover:shadow-md"
          >
            <div>
              <div className="flex items-start gap-3.5">
                {app.artworkUrl ? (
                  <Image
                    src={app.artworkUrl}
                    alt={`${app.name} icon`}
                    width={56}
                    height={56}
                    unoptimized
                    className="h-14 w-14 shrink-0 rounded-xl border border-zinc-100 bg-white object-cover shadow-xs"
                  />
                ) : (
                  <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-zinc-950 text-white">
                    <Apple className="h-7 w-7" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1.5">
                    <h3 className="truncate text-base font-bold text-zinc-950 group-hover:text-teal-700 transition">
                      {app.name}
                    </h3>
                    <span className="shrink-0 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] font-bold text-zinc-600">
                      {app.country.toUpperCase()}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-zinc-500">
                    {app.artistName || app.primaryGenreName || 'App Store'}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-xl border border-zinc-100 bg-zinc-50/70 p-2">
                  <span className="text-zinc-500 block text-[10px]">评分</span>
                  <span className="font-bold text-zinc-900 mt-0.5 block">★ {app.averageRating || 0}</span>
                </div>
                <div className="rounded-xl border border-zinc-100 bg-zinc-50/70 p-2">
                  <span className="text-zinc-500 block text-[10px]">样本</span>
                  <span className="font-bold text-zinc-900 mt-0.5 block">{app.totalReviews} 条</span>
                </div>
                <div className="rounded-xl border border-rose-100/70 bg-rose-50/50 p-2">
                  <span className="text-rose-700 block text-[10px]">差评率</span>
                  <span className="font-bold text-rose-700 mt-0.5 block">{formatPercent(app.negativeShare)}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3 text-[11px] text-zinc-500">
              <span suppressHydrationWarning>更新于 {formatDate(app.updatedAt)}</span>
              <span className="font-semibold text-teal-700 group-hover:translate-x-0.5 transition inline-flex items-center gap-0.5">
                查看洞察 →
              </span>
            </div>
          </Link>
        ))}
      </div>
      {totalPages > 1 ? (
        <nav className="mt-4 flex flex-wrap items-center justify-center gap-2" aria-label="App 分页">
          <Link
            href={pageHref(page - 1)}
            className={`rounded-md border px-3 py-2 text-sm transition ${
              page <= 1
                ? 'pointer-events-none border-zinc-100 bg-zinc-50 text-zinc-300'
                : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-950'
            }`}
          >
            上一页
          </Link>
          {pageNumbers.map((item, index) => {
            const previous = pageNumbers[index - 1];
            return (
              <span key={item} className="inline-flex items-center gap-2">
                {previous && item - previous > 1 ? <span className="text-sm text-zinc-400">...</span> : null}
                <Link
                  href={pageHref(item)}
                  aria-current={item === page ? 'page' : undefined}
                  className={`min-w-10 rounded-md border px-3 py-2 text-center text-sm transition ${
                    item === page
                      ? 'border-zinc-950 bg-zinc-950 text-white'
                      : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-950'
                  }`}
                >
                  {item}
                </Link>
              </span>
            );
          })}
          <Link
            href={pageHref(page + 1)}
            className={`rounded-md border px-3 py-2 text-sm transition ${
              page >= totalPages
                ? 'pointer-events-none border-zinc-100 bg-zinc-50 text-zinc-300'
                : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-950'
            }`}
          >
            下一页
          </Link>
        </nav>
      ) : null}
    </section>
  );
}

export default function Home({
  featuredApps = [],
  initialCachePage = 1,
  initialQuery = '',
  initialCountry = 'cn',
}: {
  featuredApps?: FeaturedAppSummary[];
  initialCachePage?: number;
  initialQuery?: string;
  initialCountry?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [country, setCountry] = useState(initialCountry);
  const maxReviews = 160;
  const [loading, setLoading] = useState(false);
  const [analyzingAI, setAnalyzingAI] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ResearchData | null>(null);

  useEffect(() => {
    let id: string | null = null;
    try { id = localStorage.getItem(PENDING_RESEARCH_KEY); } catch { return; }
    if (!id) return;
    const controller = new AbortController();
    // Storage is an external system; recovery starts after mount without
    // changing state during the synchronous effect setup.
    queueMicrotask(() => { if (!controller.signal.aborted) setLoading(true); });
    resumeResearchJob<ResearchData>(id,controller.signal).then(setResult).catch((error: unknown) => {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : '进度恢复失败');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  const maxBucket = useMemo(() => result ? maxRatingBucket(result.stats) : 1, [result]);
  const visibleInsights = result?.insights && hasMeaningfulClientInsights(result.insights) ? result.insights : null;

  const executeResearch = async (targetQuery: string, targetCountry: string) => {
    if (!targetQuery.trim()) return;

    setLoading(true);
    setError('');

    try {
      setResult(await requestResearch<ResearchData>('/api/research', {
        query: targetQuery, country: targetCountry, maxReviews, analyze: false,
      }));
    } catch (researchError) {
      setError(researchError instanceof Error ? researchError.message : '检索失败');
    } finally {
      setLoading(false);
    }
  };

  const triggerAIAnalysis = async () => {
    if (!result || analyzingAI) return;

    setAnalyzingAI(true);
    setError('');

    try {
      setResult(await requestResearch<ResearchData>('/api/research', {
        query: result.app.id, country: result.app.country, maxReviews, analyze: true,
      }));
    } catch (aiError) {
      setError(aiError instanceof Error ? aiError.message : 'AI 研判生成失败');
    } finally {
      setAnalyzingAI(false);
    }
  };

  const runResearch = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    await executeResearch(query, country);
  };

  return (
    <main className="min-h-screen bg-[#f7f7f4] text-zinc-950">
      <header className="border-b border-zinc-200 bg-white/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <BrandMark compact />
          <div className="flex items-center gap-2">
            <Link href="/discover" className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-950">
              <Compass className="h-4 w-4" />
              探索
            </Link>
            <SiteAffordances subtle />
          </div>
        </div>
      </header>

      <section className="border-b border-zinc-200 bg-gradient-to-b from-white via-[#fdfdfb] to-[#f7f7f4]/40 py-10 sm:py-14">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50/80 px-3.5 py-1 text-xs font-medium text-teal-800 backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-teal-600" />
            <span>AI 驱动的 App 评论与口碑研判</span>
          </div>

          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-zinc-950 sm:text-5xl sm:leading-tight">
            从真实用户评价中，<br className="hidden sm:inline" />发现关键痛点与产品机会
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-base text-zinc-600 sm:text-lg">
            输入任意 iOS 应用名称或 App Store 链接，先查看真实评论样本，再按需生成可溯源的 AI 研判，提炼产品痛点、版本问题与改进建议。
          </p>

          <form onSubmit={runResearch} className="mt-8 rounded-2xl border border-zinc-200/90 bg-white p-2 shadow-lg shadow-zinc-200/50 transition focus-within:border-zinc-400 focus-within:ring-4 focus-within:ring-zinc-900/5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative flex-1 min-w-0">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
                <Input
                  aria-label="App 名称、App Store 链接或 App ID"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="输入 App 名称、App Store 链接或 App ID..."
                  className="h-12 border-0 bg-transparent pl-11 pr-10 text-base text-zinc-900 placeholder:text-zinc-400 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery('');
                      setError('');
                    }}
                    aria-label="清除搜索内容"
                    className="absolute right-3 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>

              <div className="relative flex items-center border-t border-zinc-100 sm:border-t-0 sm:border-l sm:border-zinc-200 sm:pl-3">
                <select
                  value={country}
                  onChange={(event) => setCountry(event.target.value)}
                  className="h-11 appearance-none bg-transparent pl-2 pr-7 text-sm font-medium text-zinc-700 outline-none cursor-pointer hover:text-zinc-950"
                  aria-label="选择 App Store 地区"
                >
                  {countryOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <ChevronsUpDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              </div>

              <Button
                type="submit"
                disabled={loading || !query.trim()}
                className="h-11 rounded-xl bg-zinc-950 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Search className="h-4 w-4 mr-1.5" />}
                开始搜索
              </Button>
            </div>
          </form>

          {/* Quick research sample chips */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-zinc-500">
            <span className="font-medium text-zinc-500">快速体验:</span>
            {[
              { label: 'ChatGPT', query: 'ChatGPT', country: 'us', flag: '🇺🇸' },
              { label: 'Notion', query: 'Notion', country: 'us', flag: '🇺🇸' },
              { label: 'Duolingo', query: 'Duolingo', country: 'us', flag: '🇺🇸' },
              { label: '微信', query: '微信', country: 'cn', flag: '🇨🇳' },
              { label: '小红书', query: '小红书', country: 'cn', flag: '🇨🇳' },
            ].map((sample) => (
              <button
                key={sample.label}
                type="button"
                onClick={() => {
                  setQuery(sample.query);
                  setCountry(sample.country);
                  executeResearch(sample.query, sample.country);
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200/80 bg-white px-3 py-1 text-xs font-medium text-zinc-700 shadow-xs transition hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-950"
              >
                <span>{sample.flag}</span>
                <span>{sample.label}</span>
              </button>
            ))}
          </div>

          {error ? (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50/90 p-4 text-left text-sm text-rose-700 shadow-xs">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          {loading ? (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50/90 p-4 text-left text-sm text-sky-800 shadow-xs" role="status" aria-live="polite">
              <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-sky-600" />
              <div>
                <p className="font-semibold text-sky-950">正在获取应用信息与评论数据...</p>
                <p className="mt-1 text-xs text-sky-700 leading-relaxed">正在准备报告，可能需要几分钟。刷新或稍后返回首页可恢复已登记任务的进度。</p>
              </div>
            </div>
          ) : null}


        </div>
      </section>

      {result ? (
        <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {result.source === 'search' && result.candidates.length > 1 ? (
            <section className="mb-4 rounded-lg border border-zinc-200 bg-white p-4" aria-label="匹配的应用">
              <p className="text-sm font-medium text-zinc-800">不是你要找的应用？选择其他匹配结果：</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {result.candidates.map(candidate => (
                  <button key={candidate.id} type="button" disabled={loading || analyzingAI || candidate.id === result.app.id}
                    onClick={() => { setQuery(candidate.id); setCountry(candidate.country); void executeResearch(candidate.id,candidate.country); }}
                    className="max-w-full break-words rounded-md border border-zinc-200 px-3 py-2 text-left text-sm text-zinc-700 hover:border-teal-500 disabled:opacity-50">
                    {candidate.name} · {candidate.artistName}
                  </button>
                ))}
              </div>
            </section>
          ) : null}
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <section className="min-w-0 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 gap-4">
                  <AppIcon app={result.app} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-2xl font-semibold leading-tight text-zinc-950">{result.app.name}</h2>
                      <span className="rounded-full border border-zinc-200 px-2 py-0.5 text-xs text-zinc-500">
                        {result.app.country.toUpperCase()}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-sm text-zinc-500">{result.app.artistName || '未知开发者'}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-500">
                      {result.app.primaryGenreName ? <span className="rounded-md bg-zinc-100 px-2 py-1">{result.app.primaryGenreName}</span> : null}
                      {result.app.version ? <span className="rounded-md bg-zinc-100 px-2 py-1">v{result.app.version}</span> : null}
                      <span className="rounded-md bg-zinc-100 px-2 py-1">{result.source === 'search' ? '名称匹配' : result.source === 'url' ? '链接解析' : 'ID 查询'}</span>
                    </div>
                  </div>
                </div>
                {result.app.trackViewUrl ? (
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={result.pageUrl}
                      className="inline-flex items-center justify-center gap-1 rounded-md bg-zinc-950 px-3 py-2 text-sm text-white transition hover:bg-zinc-800"
                    >
                      查看洞察页
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                    <a
                      href={result.app.trackViewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-1 rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-950"
                    >
                      App Store
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </a>
                  </div>
                ) : null}
              </div>
              <div className={`mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${visibleInsights ? 'border-teal-100 bg-teal-50 text-teal-800' : result.aiError ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-sky-200 bg-sky-50 text-sky-800'}`}>
                <div>
                  {visibleInsights ? '洞察报告已就绪' : result.aiError ? '评论已抓取，AI 洞察未完成' : '评论数据已准备'}：<Link href={result.pageUrl} className="font-semibold underline underline-offset-4">查看稳定报告页</Link>
                  <span className="ml-2 text-teal-700">更新于 {formatFullDate(result.updatedAt)}</span>
                </div>
                {!visibleInsights && result.stats.totalReviews > 0 ? (
                  <button
                    type="button"
                    onClick={triggerAIAnalysis}
                    disabled={analyzingAI}
                    aria-busy={analyzingAI}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-800 disabled:cursor-wait disabled:opacity-70"
                  >
                    {analyzingAI ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    {analyzingAI ? '正在生成…' : result.aiError ? '重试 AI 研判' : '生成 AI 研判'}
                  </button>
                ) : null}
              </div>
              {result.generation?.message ? (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
                  {result.generation.message}
                </div>
              ) : null}
              {result.stats.totalReviews > 0 && result.stats.totalReviews < 20 ? (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm leading-6 text-amber-800" role="note">
                  当前只拿到 {result.stats.totalReviews} 条评论样本，适合做方向性探索；生成 AI 研判前建议先确认样本量是否足够。
                </div>
              ) : null}
            </section>

            <section className="min-w-0 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-500">样本均分</p>
                  <p className="mt-1 text-3xl font-semibold text-zinc-950">{result.stats.averageRating || '0.00'}</p>
                </div>
                <div className="grid h-12 w-12 place-items-center rounded-lg bg-amber-50 text-amber-600">
                  <Star className="h-6 w-6 fill-current" />
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {[5, 4, 3, 2, 1].map((rating) => {
                  const count = ratingCount(result.stats, rating);
                  const width = `${Math.max(3, Math.round((count / maxBucket) * 100))}%`;
                  return (
                    <div key={rating} className="grid grid-cols-[24px_minmax(0,1fr)_40px] items-center gap-2 text-xs text-zinc-500">
                      <span>{rating}星</span>
                      <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                        <div className="h-full rounded-full bg-amber-400" style={{ width }} />
                      </div>
                      <span className="text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-zinc-200/80 bg-white p-4 shadow-xs">
              <p className="text-xs font-medium text-zinc-500">抓取样本量</p>
              <p className="mt-1 text-2xl font-bold text-zinc-950">{result.stats.totalReviews}</p>
            </div>
            <div className="rounded-xl border border-zinc-200/80 bg-white p-4 shadow-xs">
              <p className="text-xs font-medium text-zinc-500">差评占比 (1-2星)</p>
              <p className="mt-1 text-2xl font-bold text-rose-600">{formatPercent(result.stats.negativeShare)}</p>
            </div>
            <div className="rounded-xl border border-zinc-200/80 bg-white p-4 shadow-xs">
              <p className="text-xs font-medium text-zinc-500">好评占比 (4-5星)</p>
              <p className="mt-1 text-2xl font-bold text-emerald-600">{formatPercent(result.stats.positiveShare)}</p>
            </div>
            <div className="rounded-xl border border-zinc-200/80 bg-white p-4 shadow-xs">
              <p className="text-xs font-medium text-zinc-500">评论跨越周期</p>
              <p className="mt-1 text-base font-semibold text-zinc-900 truncate" suppressHydrationWarning>{formatDate(result.stats.oldestReviewDate)} - {formatDate(result.stats.latestReviewDate)}</p>
            </div>
          </div>

          <ReviewSourceBreakdownPanel breakdown={result.sourceBreakdown} className="mt-4" />

          <section className="mt-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-zinc-950">用户评价洞察</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  {result.model ? `${result.model.provider} · ${result.model.model}` : '评论证据优先'}
                </p>
              </div>
              {visibleInsights ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  已生成
                </span>
              ) : null}
            </div>

            {result.aiError ? (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {result.aiError}
              </div>
            ) : null}

            {visibleInsights ? (
              <>
                <div className="rounded-xl border border-teal-200/80 bg-gradient-to-r from-teal-50/70 via-white to-emerald-50/40 p-5 shadow-xs">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-800">
                    <Sparkles className="h-4 w-4 text-teal-600" />
                    <span>AI 综合口碑研判</span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-800 font-medium">
                    {visibleInsights.executiveSummary}
                  </p>
                </div>
                <div className="mt-5">
                  <InsightGrid insights={visibleInsights} />
                </div>
                {visibleInsights.queryAngles.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {visibleInsights.queryAngles.map((angle) => (
                      <span key={angle} className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs text-sky-700">
                        {angle}
                      </span>
                    ))}
                  </div>
                ) : null}
              </>
            ) : analyzingAI ? (
              <div className="rounded-xl border border-teal-200 bg-gradient-to-r from-teal-50/60 via-white to-emerald-50/30 p-6 shadow-xs">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-teal-600 shrink-0" />
                  <div>
                    <p className="font-semibold text-teal-900">正在生成 AI 深度口碑研判...</p>
                    <p className="mt-1 text-xs text-teal-700 leading-relaxed">AI 正在分析 {result.stats.totalReviews} 条评论，提炼核心痛点、产品机会与用户信号。通常需要几十秒，刷新或稍后返回首页可恢复进度。</p>
                  </div>
                </div>
              </div>
            ) : result.stats.totalReviews > 0 ? (
              <div className="rounded-xl border-2 border-dashed border-teal-300/70 bg-gradient-to-br from-teal-50/50 via-white to-emerald-50/30 p-6 text-center shadow-xs transition hover:border-teal-400/80 hover:shadow-sm">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-teal-100/80 text-teal-700">
                  <Sparkles className="h-6 w-6" />
                </div>
                <h3 className="mt-3 text-base font-bold text-zinc-950">一键生成 AI 深度口碑研判</h3>
                <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500 leading-relaxed">
                  AI 将分析 {result.stats.totalReviews} 条用户评论，自动提炼产品痛点、改进机会、正面信号与版本风险，每条结论可溯源原文。
                </p>
                <button
                  type="button"
                  onClick={triggerAIAnalysis}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800 active:scale-[0.98]"
                >
                  <Sparkles className="h-4 w-4" />
                  生成 AI 研判报告
                </button>
                <p className="mt-3 text-xs text-zinc-500">通常需要几十秒；完成后可查看稳定报告和评论证据。</p>
              </div>
            ) : (
              <div className="rounded-lg bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-500">
                暂无评论样本。
              </div>
            )}
          </section>

          {result.stats.versionDistribution.length > 0 ? (
            <section className="mt-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-zinc-950">版本样本</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                {result.stats.versionDistribution.map((version) => (
                  <div key={version.version} className="rounded-md border border-zinc-100 bg-zinc-50 p-3">
                    <p className="truncate text-sm font-semibold text-zinc-900">{version.version}</p>
                    <p className="mt-2 text-xs text-zinc-500">{version.count} 条 · {version.averageRating} 星</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="mt-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-zinc-950">评论证据</h2>
              <span className="text-sm text-zinc-500">{result.reviews.length} 条</span>
            </div>
            <div className="space-y-3">
              {result.reviews.map((review) => (
                <article key={review.id} className="rounded-lg border border-zinc-100 bg-zinc-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="break-words text-sm font-semibold leading-6 text-zinc-950">{review.title}</h3>
                      <p className="mt-1 text-xs text-zinc-500" suppressHydrationWarning>
                        {review.version || 'Unknown'} · {formatDate(review.updated)} · {review.authorName || '匿名'} · {reviewSourceLabel(review.source, review.sourceCountry || review.country)}
                      </p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-200 bg-white px-2 py-1 text-xs text-amber-700">
                      <Star className="h-3.5 w-3.5 fill-current" />
                      {review.rating}
                    </span>
                  </div>
                  <p className="mt-3 break-words text-sm leading-7 text-zinc-700">{review.content}</p>
                </article>
              ))}
            </div>
          </section>
        </section>
      ) : (
        <>
          <FeaturedApps apps={featuredApps} currentPage={initialCachePage} />
        </>
      )}

    </main>
  );
}

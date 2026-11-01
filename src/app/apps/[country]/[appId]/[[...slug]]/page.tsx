import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { AlertCircle, Apple, ArrowLeft, ArrowUpRight, Lightbulb, Search, ShieldCheck, Sparkles, Star, Target, TrendingDown } from 'lucide-react';
import { InsightGrid } from '@/components/app-review/insight-cards';
import { RegenerateButton } from '@/components/app-review/regenerate-button';
import { BrandMark, SiteFooter } from '@/components/app-review/site-footer';
import { ReviewSourceBreakdownPanel, reviewSourceLabel } from '@/components/app-review/source-breakdown';
import { VersionDiagnosticsPanel } from '@/components/app-review/version-diagnostics';
import { ResearchHistoryPanel } from '@/components/app-review/research-history';
import { CountryComparisonPanel } from '@/components/app-review/country-comparison';
import { DetailClient } from '@/components/app-review/detail-client';
import {
  CachedAppReviewPage,
  buildAppPagePath,
  buildCanonicalUrl,
  hasMeaningfulInsights,
  readCachedReviewPage,
} from '@/lib/appstore/cache';
import { buildReviewDiagnostics } from '@/lib/appstore/diagnostics';
import { normalizeCountry } from '@/lib/appstore/discovery';
import { detectResearchChanges } from '@/lib/appstore/research-history';
import { getReviewHistory } from '@/lib/appstore/review-history';
import { getCountryResearchComparison } from '@/lib/appstore/country-comparison';

export const runtime = 'nodejs';
export const revalidate = 3600;

type PageProps = {
  params: Promise<{
    country: string;
    appId: string;
    slug?: string[];
  }>;
};

function formatDate(value?: string) {
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

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function ratingCount(page: CachedAppReviewPage, rating: number) {
  return page.stats.ratingDistribution[String(rating)] || 0;
}

function maxRatingBucket(page: CachedAppReviewPage) {
  return Math.max(1, ...[1, 2, 3, 4, 5].map((rating) => ratingCount(page, rating)));
}

async function getPage(country: string, appId: string) {
  const normalizedCountry = normalizeCountry(country);
  return readCachedReviewPage(normalizedCountry, appId);
}

function MissingInsightPage({ country, appId }: { country: string; appId: string }) {
  const normalizedCountry = normalizeCountry(country);
  const searchHref = `/?q=${encodeURIComponent(appId)}&country=${encodeURIComponent(normalizedCountry)}`;

  return (
    <main className="min-h-screen bg-[#f7f7f4] text-zinc-950">
      <header className="border-b border-zinc-200 bg-white/90">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <BrandMark compact />
          </Link>
          <Link href="/" className="inline-flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-950">
            <ArrowLeft className="h-4 w-4" />
            返回首页
          </Link>
        </div>
      </header>
      <section className="mx-auto flex max-w-3xl flex-col items-center px-4 py-20 text-center sm:px-6 sm:py-28">
        <div className="grid h-14 w-14 place-items-center rounded-2xl border border-amber-200 bg-amber-50 text-amber-700">
          <Search className="h-6 w-6" />
        </div>
        <p className="mt-6 text-sm font-medium text-amber-700">尚未生成 · {normalizedCountry.toUpperCase()} 区 · App {appId}</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">这份 App 洞察还不存在</h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-zinc-600">
          查看详情页不会自动抓取评论或调用 AI。请回到首页主动发起研究，系统会先检查缓存与公开额度，再生成可追溯的评论洞察。
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href={searchHref} className="inline-flex items-center gap-2 rounded-md bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800">
            <Search className="h-4 w-4" />
            去生成这份洞察
          </Link>
          <span className="inline-flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-600">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            GET 无生成副作用
          </span>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}

function metadataDescription(page: CachedAppReviewPage) {
  return `基于 ${page.stats.totalReviews} 条 ${page.app.name} App Store 用户评价，提炼评分趋势、差评痛点、产品机会、版本风险和关键摘要。更新时间：${formatDate(page.updatedAt)}。`;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { country, appId } = await params;
  const normalizedCountry = normalizeCountry(country);
  const cached = await readCachedReviewPage(normalizedCountry, appId);

  if (!cached) {
    return {
      title: `App ${appId} 评价洞察`,
      description: 'App Store 用户评价分析页面，生成后可查看评价洞察页。',
      alternates: {
        canonical: buildCanonicalUrl(`/apps/${normalizedCountry}/${appId}`),
      },
    };
  }

  const canonicalPath = buildAppPagePath(cached.app);

  return {
    title: `${cached.app.name} 评价分析 - App Store 用户评论洞察`,
    description: metadataDescription(cached),
    keywords: [
      cached.app.name,
      `${cached.app.name} 评价`,
      `${cached.app.name} 评论`,
      'App Store 评论分析',
      '用户反馈挖掘',
      '产品机会挖掘',
      '竞品评价分析',
      '产品需求分析',
    ],
    alternates: {
      canonical: buildCanonicalUrl(canonicalPath),
    },
    openGraph: {
      title: `${cached.app.name} 评价分析`,
      description: metadataDescription(cached),
      url: buildCanonicalUrl(canonicalPath),
      siteName: '乔木 App 洞察',
      images: cached.app.artworkUrl ? [{ url: cached.app.artworkUrl, alt: `${cached.app.name} icon` }] : undefined,
      type: 'article',
    },
  };
}

export default async function AppInsightPage({ params }: PageProps) {
  const { country, appId } = await params;
  const page = await getPage(country, appId);
  if (!page) return <MissingInsightPage country={country} appId={appId} />;
  const insights = hasMeaningfulInsights(page.insights) ? page.insights : null;
  const diagnostics = page.diagnostics || buildReviewDiagnostics(page.reviews);
  const historySnapshots = await getReviewHistory(page.app.country, page.app.id);
  const historyChanges = detectResearchChanges(historySnapshots);
  const countryComparison = await getCountryResearchComparison(page.app.id);
  const maxBucket = maxRatingBucket(page);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: `${page.app.name} 评价分析`,
    description: metadataDescription(page),
    datePublished: page.generatedAt,
    dateModified: page.updatedAt,
    author: {
      '@type': 'Person',
      name: '向阳乔木',
      url: 'https://qiaomu.ai',
    },
    publisher: {
      '@type': 'Organization',
      name: '乔木 App 洞察',
      url: buildCanonicalUrl('/'),
      logo: {
        '@type': 'ImageObject',
        url: buildCanonicalUrl('/logo.svg'),
      },
    },
    mainEntity: {
      '@type': 'SoftwareApplication',
      name: page.app.name,
      applicationCategory: page.app.primaryGenreName || 'iOS App',
      operatingSystem: 'iOS',
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: page.stats.averageRating || page.app.averageUserRating || 0,
        reviewCount: page.stats.totalReviews,
      },
    },
  };

  const totalInsightsCount = insights
    ? (insights.painPoints?.length || 0) +
      (insights.opportunities?.length || 0) +
      (insights.positiveSignals?.length || 0) +
      (insights.userSegments?.length || 0) +
      (insights.versionRisks?.length || 0) +
      (insights.actionPlan?.length || 0)
    : 0;

  // 1. 核心洞察 Tab 内容
  const insightsTabContent = (
    <div className="space-y-6">
      {insights ? (
        <InsightGrid insights={insights} />
      ) : (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-8 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-amber-100 text-amber-700">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h3 className="mt-3 text-lg font-bold text-zinc-950">AI 洞察尚未生成</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-zinc-600">
            {page.aiError || '当前仅抓取了原始评论数据。点击右上角的“更新洞察”即可调用 AI 提炼痛点与机会。'}
          </p>
          <div className="mt-5 flex justify-center">
            <RegenerateButton appId={page.app.id} country={page.app.country} />
          </div>
        </div>
      )}
    </div>
  );

  // 2. 趋势与评分分布 Tab 内容
  const trendsTabContent = (
    <div className="space-y-6">
      {/* 评分星级与版本分布总览 */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-zinc-900">评分星级分布</h3>
            <span className="text-xs text-zinc-500">共 {page.stats.totalReviews} 条评分</span>
          </div>
          <div className="mt-4 space-y-2.5">
            {[5, 4, 3, 2, 1].map((rating) => {
              const count = ratingCount(page, rating);
              const width = `${Math.max(3, Math.round((count / maxBucket) * 100))}%`;
              return (
                <div key={rating} className="grid grid-cols-[36px_minmax(0,1fr)_48px] items-center gap-3 text-xs text-zinc-600">
                  <span className="font-medium">{rating} 星</span>
                  <div className="h-2.5 overflow-hidden rounded-full bg-zinc-100">
                    <div className="h-full rounded-full bg-amber-400 transition-all" style={{ width }} />
                  </div>
                  <span className="text-right font-medium text-zinc-900">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-zinc-900">主要版本样本</h3>
            <span className="text-xs text-zinc-500">按近期活跃度</span>
          </div>
          <div className="mt-4 space-y-2.5 max-h-[160px] overflow-y-auto pr-1">
            {page.stats.versionDistribution.length === 0 ? (
              <p className="text-xs text-zinc-600">暂无版本细分。</p>
            ) : (
              page.stats.versionDistribution.map((version) => (
                <div key={version.version} className="flex items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50/70 px-3 py-2 text-xs">
                  <span className="font-semibold text-zinc-900">v{version.version}</span>
                  <span className="text-zinc-500">{version.count} 条 · ★ {version.averageRating}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <VersionDiagnosticsPanel diagnostics={diagnostics} appName={page.app.name} />
      <ResearchHistoryPanel snapshots={historySnapshots} changes={historyChanges} />
      <CountryComparisonPanel comparison={countryComparison} />
    </div>
  );

  // 3. 用户原声证据 Tab 内容
  const evidenceTabContent = (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm">
        <div>
          <h3 className="text-base font-bold text-zinc-950">真实用户评论样本</h3>
          <p className="text-xs text-zinc-500">每条 AI 结论均保留对应的真实评论出处，支持回溯验证</p>
        </div>
        <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-600">
          共 {page.reviews.length} 条代表性样本
        </span>
      </div>

      <div className="grid gap-3">
        {page.reviews.map((review) => (
          <article key={review.id} className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm transition hover:border-zinc-300">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700">
                    <Star className="h-3 w-3 fill-current" />
                    {review.rating}
                  </span>
                  <h4 className="break-words text-sm font-bold text-zinc-950">{review.title}</h4>
                </div>
                <p className="mt-1 text-xs text-zinc-600" suppressHydrationWarning>
                  {review.version ? `v${review.version}` : '版本未知'} · {formatDate(review.updated)} · {review.authorName || '匿名用户'} · {reviewSourceLabel(review.source, review.sourceCountry || review.country)}
                </p>
              </div>
            </div>
            <p className="mt-3 break-words text-sm leading-relaxed text-zinc-700">{review.content}</p>
          </article>
        ))}
      </div>
    </div>
  );

  return (
    <main className="min-h-screen bg-[#f8f9fa] text-zinc-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* 顶部极简导航 */}
      <header className="border-b border-zinc-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <BrandMark compact />
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 transition hover:border-zinc-300 hover:text-zinc-950 shadow-sm"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              返回搜索
            </Link>
          </div>
        </div>
      </header>

      {/* 核心档案与 AI 执行摘要 (结论先行) */}
      <section className="border-b border-zinc-200/80 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
          {/* App 基础信息栏 */}
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 gap-4 sm:gap-5">
              {page.app.artworkUrl ? (
                <Image
                  src={page.app.artworkUrl}
                  alt={`${page.app.name} icon`}
                  width={80}
                  height={80}
                  unoptimized
                  className="h-20 w-20 shrink-0 rounded-2xl border border-zinc-200 bg-white object-cover shadow-sm"
                />
              ) : (
                <div className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-zinc-950 text-white">
                  <Apple className="h-9 w-9" />
                </div>
              )}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-0.5 text-xs font-bold text-teal-700">
                    {page.app.country.toUpperCase()} 区
                  </span>
                  {page.app.primaryGenreName ? (
                    <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-xs font-medium text-zinc-600">
                      {page.app.primaryGenreName}
                    </span>
                  ) : null}
                </div>
                <h1 className="mt-2.5 break-words text-2xl font-extrabold leading-tight text-zinc-950 sm:text-3xl">
                  {page.app.name}
                </h1>
                <p className="mt-1 text-xs text-zinc-500" suppressHydrationWarning>
                  {page.app.artistName || 'App Store 开发者'} · 更新于 {formatDate(page.updatedAt)}
                </p>
              </div>
            </div>

            {/* 操作与 App Store 按钮 */}
            <div className="flex flex-wrap items-center gap-2.5 self-start">
              {page.app.trackViewUrl ? (
                <a
                  href={page.app.trackViewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 transition hover:border-zinc-300 hover:text-zinc-950 shadow-sm"
                >
                  App Store 原页
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              ) : null}
              <RegenerateButton appId={page.app.id} country={page.app.country} />
            </div>
          </div>

          {/* AI 核心研判速览 (结论先行) */}
          <div className="rounded-2xl border border-teal-200/80 bg-gradient-to-br from-teal-50/60 via-white to-emerald-50/40 p-5 sm:p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-800">
                <Sparkles className="h-4 w-4 text-teal-600" />
                AI 用户口碑综合研判
              </div>
              <span className="text-xs text-zinc-600">
                分析模型：{page.model?.model || 'DeepSeek Flash'}
              </span>
            </div>

            {insights?.executiveSummary ? (
              <p className="mt-3 text-base leading-relaxed font-medium text-zinc-800">
                {insights.executiveSummary}
              </p>
            ) : (
              <p className="mt-3 text-sm text-zinc-700">
                {page.aiError || '当前展示评论基础数据统计，点击右上角更新可生成 AI 洞察。'}
              </p>
            )}

            {/* 4 核心数据胶囊 */}
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-white/80 bg-white/90 p-3 shadow-xs">
                <p className="text-xs font-medium text-zinc-600">用户评分</p>
                <p className="mt-1 text-xl font-bold text-zinc-950">★ {page.stats.averageRating || '0.0'}</p>
              </div>
              <div className="rounded-xl border border-white/80 bg-white/90 p-3 shadow-xs">
                <p className="text-xs font-medium text-zinc-600">差评痛点占比</p>
                <p className="mt-1 text-xl font-bold text-rose-600">{formatPercent(page.stats.negativeShare)}</p>
              </div>
              <div className="rounded-xl border border-white/80 bg-white/90 p-3 shadow-xs">
                <p className="text-xs font-medium text-zinc-600">好评认同占比</p>
                <p className="mt-1 text-xl font-bold text-emerald-600">{formatPercent(page.stats.positiveShare)}</p>
              </div>
              <div className="rounded-xl border border-white/80 bg-white/90 p-3 shadow-xs">
                <p className="text-xs font-medium text-zinc-600">分析样本总数</p>
                <p className="mt-1 text-xl font-bold text-zinc-900">{page.stats.totalReviews} 条</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 主体交互区域：三大 Tab 渐进式呈现 */}
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-10">
        <DetailClient
          insightsCount={totalInsightsCount}
          reviewsCount={page.reviews.length}
          insightsTabContent={insightsTabContent}
          trendsTabContent={trendsTabContent}
          evidenceTabContent={evidenceTabContent}
        />

        {/* 底部收纳：数据透明度说明 */}
        <section className="pt-6 border-t border-zinc-200/70">
          <ReviewSourceBreakdownPanel breakdown={page.sourceBreakdown} />
        </section>

        {/* 页面使用帮助 */}
        <section className="rounded-2xl border border-zinc-200/70 bg-white p-6 shadow-sm">
          <div className="grid gap-6 sm:grid-cols-3">
            <div>
              <TrendingDown className="h-5 w-5 text-rose-600" />
              <h3 className="mt-2.5 text-sm font-bold text-zinc-950">如何应用这些痛点？</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">重点关注高频差评中的产品稳定性、付费阻力及竞品遗留缺陷，可直接作为产品迭代的需求池依据。</p>
            </div>
            <div>
              <Lightbulb className="h-5 w-5 text-amber-600" />
              <h3 className="mt-2.5 text-sm font-bold text-zinc-950">如何发现产品机会？</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">用户在三星与差评中反复呼吁却长期未被满足的特性，往往是新产品切入的绝佳利基点。</p>
            </div>
            <div>
              <Target className="h-5 w-5 text-teal-600" />
              <h3 className="mt-2.5 text-sm font-bold text-zinc-950">证据核对保障</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">随时切换至“用户原声证据”Tab，即可直接查阅每条结论对应的用户原声，确保决策严谨有据。</p>
            </div>
          </div>
        </section>
      </div>

      <SiteFooter />
    </main>
  );
}

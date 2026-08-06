import { ArrowUpRight, Globe2, Scale } from 'lucide-react';
import type { CountryResearchComparison } from '@/lib/appstore/country-comparison';

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '未知' : new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit' }).format(date);
}

export function CountryComparisonPanel({ comparison }: { comparison: CountryResearchComparison | null }) {
  if (!comparison || comparison.countries.length < 2) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 pb-6 sm:px-6 lg:px-8">
      <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-sky-700">
              <Globe2 className="h-4 w-4" />
              Country Comparison
            </div>
            <h2 className="mt-2 text-xl font-semibold text-zinc-950">多国家研究对比</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">同一个 App 在不同 storefront 的评分、负面信号和主题分布对照。</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-100 bg-sky-50 px-3 py-1.5 text-xs text-sky-700"><Scale className="h-3.5 w-3.5" />{comparison.countries.length} 个国家/地区</span>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {comparison.countries.map((entry) => (
            <article key={entry.country} className="rounded-lg border border-zinc-100 bg-zinc-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-zinc-950">{entry.country.toUpperCase()} 区</p>
                  <p className="mt-1 text-xs text-zinc-400">更新于 {formatDate(entry.updatedAt)}</p>
                </div>
                <a href={entry.pagePath} className="inline-flex items-center gap-1 text-xs text-teal-700 hover:text-teal-900">查看 <ArrowUpRight className="h-3.5 w-3.5" /></a>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md bg-white p-2"><p className="text-[11px] text-zinc-400">均分</p><p className="mt-1 font-semibold text-zinc-900">{entry.averageRating}</p></div>
                <div className="rounded-md bg-white p-2"><p className="text-[11px] text-zinc-400">差评</p><p className="mt-1 font-semibold text-rose-600">{percent(entry.negativeShare)}</p></div>
                <div className="rounded-md bg-white p-2"><p className="text-[11px] text-zinc-400">本区样本</p><p className="mt-1 font-semibold text-zinc-900">{entry.totalReviews}</p></div>
              </div>
              <p className="mt-3 text-xs text-zinc-400">{entry.sampleScope === 'mixed' ? `混合页中识别到 ${entry.totalReviews}/${entry.rawSampleCount} 条本区评论` : '样本来源与当前 storefront 一致'}</p>
              <div className="mt-4">
                <p className="text-xs font-medium text-zinc-500">主要主题</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {entry.topThemes.length > 0 ? entry.topThemes.map((theme) => <span key={theme.key} className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs text-zinc-600">{theme.label} · {theme.count}</span>) : <span className="text-xs text-zinc-400">暂无主题信号</span>}
                </div>
              </div>
            </article>
          ))}
        </div>

        <p className="mt-4 text-xs leading-5 text-zinc-400">{comparison.note}</p>
      </div>
    </section>
  );
}

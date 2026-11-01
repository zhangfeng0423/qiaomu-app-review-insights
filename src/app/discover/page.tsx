import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import ProductSignals from '@/components/app-review/product-signals';
import { BrandMark } from '@/components/app-review/site-footer';
import { TopChartsSection } from '@/components/app-review/top-charts-section';
import { fetchHackerNewsSignals } from '@/lib/signals/hacker-news';
import {
  TOP_CHART_CATEGORIES,
  TOP_CHART_COUNTRIES,
  fetchTopChartApps,
} from '@/lib/appstore/top-charts';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '探索研究信号 - 乔木 App 洞察',
  description: '浏览 App Store 榜单与 Hacker News 产品信号，再选择值得进入评论洞察流程的 App。',
};

export default async function DiscoverPage() {
  const [apps, signals] = await Promise.all([
    fetchTopChartApps({ country: 'cn', chart: 'free', category: 'all', limit: 10 }).catch((error) => {
      console.error('Failed to load initial top charts:', error);
      return [];
    }),
    fetchHackerNewsSignals().catch((error) => {
      console.error('Failed to load Hacker News signals:', error);
      return [];
    }),
  ]);

  return (
    <main className="min-h-screen bg-[#f7f7f4] text-zinc-950">
      <header className="border-b border-zinc-200 bg-white/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3"><BrandMark compact /></Link>
          <Link href="/" className="inline-flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-950">
            <ArrowLeft className="h-4 w-4" />
            返回首页
          </Link>
        </div>
      </header>
      <ProductSignals signals={signals} />
      <TopChartsSection countries={TOP_CHART_COUNTRIES} categories={TOP_CHART_CATEGORIES} initialApps={apps} />
    </main>
  );
}

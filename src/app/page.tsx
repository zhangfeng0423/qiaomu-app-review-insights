import type { Metadata } from 'next';
import AppReviewHome from '@/components/app-review/home-client';
import { getCachedAppSummaries } from '@/lib/appstore/cache';
import { normalizeCountry } from '@/lib/appstore/discovery';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '乔木 App 洞察 - App Store 用户评价分析与产品机会挖掘',
  description: '搜索任意 iOS App，生成用户评价洞察页面，从 App Store 评论中提炼痛点、机会、版本风险和用户需求。',
  keywords: [
    '乔木 App 洞察',
    'App 评价分析',
    'App Store 评论分析',
    '用户反馈挖掘',
    '产品机会挖掘',
    '竞品评价分析',
    '产品需求分析',
  ],
  alternates: {
    canonical: 'https://appreview.qiaomu.ai/',
  },
  openGraph: {
    title: '乔木 App 洞察',
    description: '把 App Store 用户评价生成产品洞察页面，快速发现产品痛点、机会和版本风险。',
    url: 'https://appreview.qiaomu.ai/',
    siteName: '乔木 App 洞察',
    type: 'website',
  },
};

type PageProps = {
  searchParams?: Promise<{
    cachePage?: string;
    q?: string;
    country?: string;
  }>;
};

function parseCachePage(value?: string) {
  const parsed = Number.parseInt(String(value || '1'), 10);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, parsed);
}

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  const featuredApps = await getCachedAppSummaries();
  const initialCachePage = parseCachePage(params?.cachePage);

  return (
    <AppReviewHome
      featuredApps={featuredApps}
      initialCachePage={initialCachePage}
      initialQuery={String(params?.q || '').trim()}
      initialCountry={normalizeCountry(params?.country)}
    />
  );
}

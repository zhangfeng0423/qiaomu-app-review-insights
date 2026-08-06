import { listCachedReviewPages } from '@/lib/appstore/cache';
import { normalizeCountry } from '@/lib/appstore/discovery';
import { buildReviewDiagnostics } from '@/lib/appstore/diagnostics';
import { summarizeReviews } from '@/lib/appstore/review-summary';

export interface CountryThemeSignal {
  key: string;
  label: string;
  count: number;
}

export interface CountryResearchEntry {
  country: string;
  pagePath: string;
  updatedAt: string;
  totalReviews: number;
  rawSampleCount: number;
  sampleScope: 'country' | 'mixed';
  averageRating: number;
  negativeShare: number;
  positiveShare: number;
  topThemes: CountryThemeSignal[];
}

export interface CountryResearchComparison {
  appId: string;
  appName: string;
  countries: CountryResearchEntry[];
  note: string;
}

export async function getCountryResearchComparison(appId: string): Promise<CountryResearchComparison | null> {
  const pages = (await listCachedReviewPages())
    .filter((page) => page.app.id === appId)
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());

  if (pages.length === 0) return null;

  return {
    appId,
    appName: pages[0].app.name,
    countries: pages.map((page) => {
      const country = normalizeCountry(page.app.country);
      const allReviews = page.allReviews?.length ? page.allReviews : page.reviews;
      const rawSampleCount = allReviews.length;
      const mixedSource = Boolean(page.sourceBreakdown?.estimated || (page.sourceBreakdown?.countryCount || 0) > 1);
      const scopedReviews = mixedSource
        ? allReviews.filter((review) => normalizeCountry(review.sourceCountry || review.country || country) === country)
        : allReviews;
      const stats = summarizeReviews(scopedReviews);
      const diagnostics = buildReviewDiagnostics(scopedReviews);
      const themeCounts = new Map<string, CountryThemeSignal>();
      for (const cell of diagnostics.issueHeatmap) {
        const existing = themeCounts.get(cell.themeKey) || { key: cell.themeKey, label: cell.themeLabel, count: 0 };
        existing.count += cell.count;
        themeCounts.set(cell.themeKey, existing);
      }

      return {
        country,
        pagePath: page.pagePath,
        updatedAt: page.updatedAt,
        totalReviews: stats.totalReviews,
        rawSampleCount,
        sampleScope: mixedSource ? 'mixed' : 'country',
        averageRating: stats.averageRating,
        negativeShare: stats.negativeShare,
        positiveShare: stats.positiveShare,
        topThemes: Array.from(themeCounts.values()).sort((left, right) => right.count - left.count).slice(0, 3),
      };
    }),
    note: '优先使用 sourceCountry 与当前 storefront 一致的评论；如果页面包含跨 storefront 补样本，对比会标注为混合样本。不同国家/地区的数量、语言和用户结构可能不同，因此不代表总体市场份额或整体满意度。',
  };
}

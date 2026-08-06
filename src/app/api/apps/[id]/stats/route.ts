import { NextRequest, NextResponse } from 'next/server';
import { findCachedReviewPage } from '@/lib/appstore/cache';
import { ApiResponse } from '@/types';

interface AppStats {
  totalReviews: number;
  averageRating: number;
  ratingDistribution: Record<string, number>;
  lastAnalyzed?: string;
  analysisProgress: number;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<AppStats>>> {
  void request;
  const { id } = await params;
  const cachedPage = await findCachedReviewPage(id);
  if (!cachedPage) return NextResponse.json({ success: false, error: '应用不存在' }, { status: 404 });
  return NextResponse.json({
    success: true,
    data: {
      totalReviews: cachedPage.stats.totalReviews,
      averageRating: cachedPage.stats.averageRating,
      ratingDistribution: cachedPage.stats.ratingDistribution,
      lastAnalyzed: cachedPage.insights ? cachedPage.updatedAt : undefined,
      analysisProgress: cachedPage.insights ? 100 : 0,
    },
  });
}

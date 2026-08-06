import { NextRequest, NextResponse } from 'next/server';
import { resolveCachedPageForRequest } from '@/lib/appstore/request-page';
import { ApiResponse, AppStoreReview, AnalysisResult } from '@/types';

interface ReviewsResponse {
  reviews: AppStoreReview[];
  analysisResults: AnalysisResult[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<ReviewsResponse>>> {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.max(1, Number.parseInt(searchParams.get('limit') || '20', 10));
  const cachedPage = (await resolveCachedPageForRequest(request, id, 'read')).page;
  if (!cachedPage) return NextResponse.json({ success: false, error: '应用不存在' }, { status: 404 });

  const allReviews = cachedPage.allReviews?.length ? cachedPage.allReviews : cachedPage.reviews;
  const sortedReviews = [...allReviews].sort((a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime());
  const offset = (page - 1) * limit;
  return NextResponse.json({
    success: true,
    data: {
      reviews: sortedReviews.slice(offset, offset + limit),
      analysisResults: [],
      pagination: { page, limit, total: sortedReviews.length, totalPages: Math.ceil(sortedReviews.length / limit) },
    },
  });
}

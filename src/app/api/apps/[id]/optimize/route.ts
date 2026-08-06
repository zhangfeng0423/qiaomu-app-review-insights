import { NextRequest, NextResponse } from 'next/server';
import { ApiResponse } from '@/types';
import { ambiguousCachedPageResponse, resolveCachedPageForRequest } from '@/lib/appstore/request-page';

interface OptimizeResult {
  reviewsCount: number;
  analysisCount: number;
  cleanedCount: number;
  tokenEstimate: number;
  recommendations: string[];
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<OptimizeResult>>> {
  try {
    const { id } = await params;
    const pageResolution = await resolveCachedPageForRequest(request, id, 'write');
    if (pageResolution.status === 'ambiguous') return ambiguousCachedPageResponse(pageResolution);
    const page = pageResolution.page;
    if (!page) return NextResponse.json({ success: false, error: '应用不存在' }, { status: 404 });

    const reviews = page.allReviews?.length ? page.allReviews : page.reviews;
    const tokenEstimate = reviews.reduce((total, review) => {
      const text = `${review.title} ${review.content}`;
      const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
      const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
      return total + Math.ceil(chineseChars * 1.5 + englishWords * 1.3);
    }, 0);
    const recommendations = page.sourceBreakdown?.estimated
      ? ['该页面来自旧版缓存，下一次增量同步会补齐来源证据。']
      : ['统一研究缓存已完成规则过滤、聚类去重和证据计数。'];
    if (reviews.length > 100) recommendations.push('评论样本较多，建议定期增量同步。');

    return NextResponse.json({
      success: true,
      data: {
        reviewsCount: reviews.length,
        analysisCount: page.insights ? reviews.length : 0,
        cleanedCount: 0,
        tokenEstimate,
        recommendations,
      },
      message: `应用 ${page.app.name} 数据检查完成`,
    });
  } catch (error) {
    console.error('Failed to optimize app data:', error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : '数据优化失败' }, { status: 500 });
  }
}

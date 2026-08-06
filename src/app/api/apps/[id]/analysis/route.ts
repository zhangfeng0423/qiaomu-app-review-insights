import { NextRequest, NextResponse } from 'next/server';
import { cachedPageToLegacyAnalysis, findCachedReviewPage } from '@/lib/appstore/cache';
import { ApiResponse, AggregatedAnalysis } from '@/types';

// GET /api/apps/[id]/analysis - 获取聚合分析结果
// Note: `params` is provided synchronously by Next.js route handlers
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<{ analysis: AggregatedAnalysis | null }>>> {
  try {
    const { id } = await params;
    const cachedPage = await findCachedReviewPage(id);
    if (!cachedPage) {
      return NextResponse.json(
        {
          success: false,
          error: '应用不存在',
        },
        { status: 404 }
      );
    }
    return NextResponse.json({
      success: true,
      data: { analysis: cachedPage.insights ? cachedPageToLegacyAnalysis(cachedPage) : null },
    });
  } catch (error) {
    console.error('Failed to get analysis:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: '获取分析结果失败',
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { generateCachedReviewPage } from '@/lib/appstore/cache';
import { ambiguousCachedPageResponse, resolveCachedPageForRequest } from '@/lib/appstore/request-page';
import { ApiResponse } from '@/types';

interface FetchResult {
  reviewCount: number;
  message: string;
}

// POST /api/apps/[id]/fetch - 抓取指定应用的评论
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<FetchResult>>> {
  try {
    const { id } = await params;
    const resolution = await resolveCachedPageForRequest(request, id, 'write');
    if (resolution.status === 'ambiguous') return ambiguousCachedPageResponse(resolution);
    const existing = resolution.page;
    if (!existing) {
      return NextResponse.json({ success: false, error: '应用不存在' }, { status: 404 });
    }
    const generated = await generateCachedReviewPage({
      appId: id,
      country: existing.app.country,
      incremental: true,
      analyze: true,
      force: true,
    });
    const reviewCount = Math.max(0, generated.page.stats.totalReviews - (existing?.stats.totalReviews || 0));

    const result: FetchResult = {
      reviewCount,
      message: `统一研究缓存已更新，新增 ${reviewCount} 条评论`,
    };

    return NextResponse.json({
      success: true,
      data: result,
      message: result.message,
    });
  } catch (error) {
    console.error('Failed to fetch reviews:', error);

    let errorMessage = '抓取评论失败';
    if (error instanceof Error) {
      errorMessage = error.message;
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    } else {
      console.error('Non-Error object thrown:', error);
    }

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { generateCachedReviewPage } from '@/lib/appstore/cache';
import { ambiguousCachedPageResponse, resolveCachedPageForRequest } from '@/lib/appstore/request-page';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    return NextResponse.json({
      success: true,
      data: {
        reviewCount,
        message: `统一研究缓存已更新，新增 ${reviewCount} 条评论`,
      },
    });
  } catch (error) {
    console.error('Simple fetch error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '抓取评论失败',
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { generateCachedReviewPage } from '@/lib/appstore/cache';
import { ambiguousCachedPageResponse, resolveCachedPageForRequest } from '@/lib/appstore/request-page';

interface AnalyzeResult {
  analyzedCount: number;
  message: string;
  stats?: {
    totalReviews: number;
    alreadyAnalyzed: number;
    newlyAnalyzed: number;
    processingTime: number;
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const startTime = Date.now();
    const resolution = await resolveCachedPageForRequest(request, id, 'write');
    if (resolution.status === 'ambiguous') return ambiguousCachedPageResponse(resolution);
    const existing = resolution.page;
    if (!existing) return NextResponse.json({ success: false, error: '应用不存在' }, { status: 404 });

    const generated = await generateCachedReviewPage({
      appId: id,
      country: existing.app.country,
      incremental: true,
      analyze: true,
      force: true,
    });
    const totalReviews = generated.page.stats.totalReviews;
    const analyzedCount = generated.page.insights ? totalReviews : 0;
    const result: AnalyzeResult = {
      analyzedCount,
      message: `统一研究缓存已完成分析，共覆盖 ${analyzedCount} 条评论`,
      stats: {
        totalReviews,
        alreadyAnalyzed: Math.min(existing.insights ? existing.stats.totalReviews : 0, totalReviews),
        newlyAnalyzed: Math.max(0, analyzedCount - (existing.insights ? existing.stats.totalReviews : 0)),
        processingTime: Math.round((Date.now() - startTime) / 1000),
      },
    };

    return NextResponse.json({ success: true, data: result, message: result.message });
  } catch (error) {
    console.error('Failed to analyze reviews:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '分析评论失败' },
      { status: 500 }
    );
  }
}

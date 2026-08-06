import { NextRequest, NextResponse } from 'next/server';
import { findCachedReviewPage, generateCachedReviewPage } from '@/lib/appstore/cache';

interface SyncResult {
  fetchResult: { reviewCount: number; message: string };
  analysisResult: { analyzedCount: number; message: string; stats: { totalReviews: number; alreadyAnalyzed: number; newlyAnalyzed: number; processingTime: number } };
  totalTime: number;
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const startTime = Date.now();
    const existing = await findCachedReviewPage(id);
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
    const alreadyAnalyzed = existing.insights ? Math.min(existing.stats.totalReviews, totalReviews) : 0;
    const result: SyncResult = {
      fetchResult: {
        reviewCount: Math.max(0, totalReviews - existing.stats.totalReviews),
        message: `统一研究缓存已更新，当前共 ${totalReviews} 条评论`,
      },
      analysisResult: {
        analyzedCount,
        message: `统一研究缓存已完成分析，共覆盖 ${analyzedCount} 条评论`,
        stats: {
          totalReviews,
          alreadyAnalyzed,
          newlyAnalyzed: Math.max(0, analyzedCount - alreadyAnalyzed),
          processingTime: Math.round((Date.now() - startTime) / 1000),
        },
      },
      totalTime: Math.round((Date.now() - startTime) / 1000),
    };

    return NextResponse.json({ success: true, data: result, message: '统一研究缓存同步完成' });
  } catch (error) {
    console.error('Failed to sync app:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '同步失败' },
      { status: 500 }
    );
  }
}

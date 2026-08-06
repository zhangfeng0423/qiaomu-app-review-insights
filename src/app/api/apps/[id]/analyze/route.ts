import { NextRequest, NextResponse } from 'next/server';
import { findCachedReviewPage, generateCachedReviewPage } from '@/lib/appstore/cache';
import { ApiResponse } from '@/types';

interface AnalyzeResult {
  analyzedCount: number;
  message: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<AnalyzeResult>>> {
  try {
    void request;
    const { id } = await params;
    const existing = await findCachedReviewPage(id);
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
    const analyzedCount = generated.page.insights ? generated.page.stats.totalReviews : 0;
    const result = {
      analyzedCount,
      message: `统一研究缓存已完成分析，共覆盖 ${analyzedCount} 条评论`,
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

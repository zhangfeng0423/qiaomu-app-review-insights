import { NextRequest, NextResponse } from 'next/server';
import { findCachedReviewPage, generateCachedReviewPage } from '@/lib/appstore/cache';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    void request;
    const { id } = await params;
    const existing = await findCachedReviewPage(id);
    if (!existing) return NextResponse.json({ success: false, error: '应用不存在' }, { status: 404 });

    const generated = await generateCachedReviewPage({
      appId: id,
      country: existing.app.country,
      incremental: false,
      analyze: true,
      force: true,
      maxReviews: existing.maxReviews,
    });
    return NextResponse.json({ success: true, data: { reanalyzed: generated.page.insights ? generated.page.stats.totalReviews : 0 } });
  } catch (error) {
    console.error('reanalyze failed:', error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : '重新分析失败' }, { status: 500 });
  }
}

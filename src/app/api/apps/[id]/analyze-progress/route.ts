import { NextRequest, NextResponse } from 'next/server';
import { findCachedReviewPage } from '@/lib/appstore/cache';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  void request;
  const { id } = await params;
  const cachedPage = await findCachedReviewPage(id);
  if (!cachedPage) return NextResponse.json({ success: false, error: '应用不存在' }, { status: 404 });
  const total = cachedPage.stats.totalReviews;
  const analyzed = cachedPage.insights ? total : 0;
  return NextResponse.json({
    success: true,
    data: { total, analyzed, coverage: total > 0 ? Math.round((analyzed / total) * 100) : 0, lastAnalyzed: cachedPage.insights ? cachedPage.updatedAt : undefined },
  });
}

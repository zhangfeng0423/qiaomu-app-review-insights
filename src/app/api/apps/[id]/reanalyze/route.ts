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

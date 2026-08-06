import { NextRequest, NextResponse } from 'next/server';
import { ambiguousCachedPageResponse, resolveCachedPageForRequest } from '@/lib/appstore/request-page';

// POST /api/apps/[id]/analyze-page?offset=0&limit=50
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50')));
    const pageResolution = await resolveCachedPageForRequest(request, id, 'write');
    if (pageResolution.status === 'ambiguous') return ambiguousCachedPageResponse(pageResolution);
    const page = pageResolution.page;
    if (!page) return NextResponse.json({ success: false, error: '应用不存在' }, { status: 404 });

    const reviews = page.allReviews?.length ? page.allReviews : page.reviews;
    const total = reviews.length;
    const analyzed = page.insights ? total : 0;
    const coverage = total > 0 ? Math.round((analyzed / total) * 100) : 0;
    const analyzedInPage = page.insights ? reviews.slice(offset, offset + limit).length : 0;

    return NextResponse.json({
      success: true,
      data: { analyzedInPage, analyzed, total, coverage }
    });
  } catch (e) {
    console.error('analyze-page failed:', e);
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : '分析失败' }, { status: 500 });
  }
}

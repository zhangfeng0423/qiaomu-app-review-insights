import { NextRequest, NextResponse } from 'next/server';
import { cachedPageToLegacyAnalysis, cachedPageToLegacyApp, generateCachedReviewPage } from '@/lib/appstore/cache';
import { ambiguousCachedPageResponse, resolveCachedPageForRequest } from '@/lib/appstore/request-page';
import { ApiResponse, AggregatedAnalysis } from '@/types';

// POST /api/apps/[id]/generate-analysis - 生成聚合分析报告
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<{ analysis: AggregatedAnalysis }>>> {
  try {
    const { id } = await params;
    const resolution = await resolveCachedPageForRequest(request, id, 'write');
    if (resolution.status === 'ambiguous') return ambiguousCachedPageResponse(resolution);
    const existing = resolution.page;
    if (!existing) {
      return NextResponse.json({ success: false, error: '应用不存在' }, { status: 404 });
    }
    const result = await generateCachedReviewPage({
      appId: id,
      country: existing.app.country,
      analyze: true,
      force: true,
    });
    const app = cachedPageToLegacyApp(result.page);
    const analysis = cachedPageToLegacyAnalysis(result.page);

    return NextResponse.json({
      success: true,
      data: { analysis },
      message: `分析报告已生成：${app.name}`,
    });
  } catch (error) {
    console.error('Failed to generate analysis:', error);
    
    const errorMessage = error instanceof Error ? error.message : '生成分析报告失败';
    
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

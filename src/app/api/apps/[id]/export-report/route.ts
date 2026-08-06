import { NextRequest, NextResponse } from 'next/server';
import { cachedPageToLegacyAnalysis, cachedPageToLegacyApp } from '@/lib/appstore/cache';
import { ReportGenerator } from '@/lib/report/generator';
import { resolveCachedPageForRequest } from '@/lib/appstore/request-page';

// GET /api/apps/[id]/export-report - 导出分析报告
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'markdown'; // markdown, html, summary
    
    const page = (await resolveCachedPageForRequest(request, id, 'read')).page;
    if (!page) {
      return NextResponse.json(
        { error: '应用不存在' },
        { status: 404 }
      );
    }
    const app = cachedPageToLegacyApp(page);

    const analysis = cachedPageToLegacyAnalysis(page);
    
    let content: string;
    let contentType: string;
    let filename: string;
    
    switch (format) {
      case 'html':
        content = ReportGenerator.generateHtmlReport(app, analysis);
        contentType = 'text/html; charset=utf-8';
        filename = `${app.name}-分析报告-${new Date().toISOString().split('T')[0]}.html`;
        break;
        
      case 'summary':
        content = ReportGenerator.generateSummaryReport(app, analysis);
        contentType = 'text/plain; charset=utf-8';
        filename = `${app.name}-分析摘要-${new Date().toISOString().split('T')[0]}.txt`;
        break;
        
      case 'markdown':
      default:
        content = ReportGenerator.generateMarkdownReport(app, analysis);
        contentType = 'text/markdown; charset=utf-8';
        filename = `${app.name}-分析报告-${new Date().toISOString().split('T')[0]}.md`;
        break;
    }

    return new NextResponse(content, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('Failed to export report:', error);
    
    const errorMessage = error instanceof Error ? error.message : '导出报告失败';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

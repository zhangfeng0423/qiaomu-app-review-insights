import { NextRequest, NextResponse } from 'next/server';
import { findCachedReviewPage } from '@/lib/appstore/cache';
import { AiInsights } from '@/lib/analysis/ai-insights-service';

function exampleFor(item: { evidence?: string; summary: string; reviewIds?: string[] }) {
  return (item.reviewIds || []).slice(0, 2).map((id) => ({
    id,
    snippet: item.evidence || item.summary,
  }));
}

// GET /api/apps/[id]/ai-insights
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const page = await findCachedReviewPage(id);
    if (!page) return NextResponse.json({ success: false, error: '应用不存在' }, { status: 404 });

    const insights = page.insights;
    const issueTaxonomy = insights?.painPoints?.length ? [{
      category: '用户痛点',
      items: insights.painPoints.slice(0, 7).map((item) => ({
        title: item.title,
        summary: item.summary,
        examples: exampleFor(item),
      })),
    }] : [];
    const topSuggestions = [
      ...(insights?.opportunities || []),
      ...(insights?.actionPlan || []),
    ].slice(0, 10).map((item) => ({
      title: item.title,
      summary: item.summary,
      examples: exampleFor(item),
    }));
    const data: AiInsights = {
      quickInsights: [
        ...(insights?.executiveSummary ? [insights.executiveSummary] : []),
        ...(insights?.queryAngles || []).slice(0, 3),
      ],
      issueTaxonomy,
      topSuggestions,
    };
    return NextResponse.json({ success: true, data });
  } catch (e) {
    console.error('ai-insights failed:', e);
    return NextResponse.json({ success: false, error: '生成失败' }, { status: 500 });
  }
}

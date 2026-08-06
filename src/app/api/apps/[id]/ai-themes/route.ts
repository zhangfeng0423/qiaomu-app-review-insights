import { NextRequest, NextResponse } from 'next/server';
import { findCachedReviewPage } from '@/lib/appstore/cache';
import { ThemeItem } from '@/lib/analysis/kimi-client';

function toThemeItem(item: { title: string; summary: string; evidence?: string; reviewIds?: string[] }): ThemeItem {
  const ids = item.reviewIds || [];
  return {
    title: item.title,
    summary: item.summary,
    examples: ids.slice(0, 2).map((id) => ({ id, snippet: item.evidence || item.summary })),
  };
}

// GET /api/apps/[id]/ai-themes
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const page = await findCachedReviewPage(id);
    if (!page) return NextResponse.json({ success: false, error: '应用不存在' }, { status: 404 });

    const positive = (page.insights?.positiveSignals || []).map(toThemeItem).slice(0, 5);
    const negative = (page.insights?.painPoints || []).map(toThemeItem).slice(0, 5);

    return NextResponse.json({ success: true, data: { positive, negative } });
  } catch (e) {
    console.error('ai-themes failed:', e);
    return NextResponse.json({ success: false, error: '生成失败' }, { status: 500 });
  }
}

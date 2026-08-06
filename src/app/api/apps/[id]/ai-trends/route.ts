import { NextRequest, NextResponse } from 'next/server';
import { resolveCachedPageForRequest } from '@/lib/appstore/request-page';

// GET /api/apps/[id]/ai-trends
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const page = (await resolveCachedPageForRequest(request, id, 'read')).page;
    if (!page) return NextResponse.json({ success: false, error: '应用不存在' }, { status: 404 });

    const timeline = page.diagnostics?.sentimentTimeline || [];
    const latest = timeline[timeline.length - 1];
    const first = timeline[0];
    const bullets: string[] = [];
    if (latest) {
      bullets.push(`${latest.label} 收到 ${latest.total} 条评论，平均评分 ${latest.averageRating.toFixed(1)} 分。`);
    }
    if (first && latest && first.date !== latest.date) {
      const negativeDelta = latest.negative - first.negative;
      const direction = negativeDelta > 0 ? '增加' : negativeDelta < 0 ? '减少' : '保持稳定';
      bullets.push(`负面评论从 ${first.negative} 条到 ${latest.negative} 条，${direction} ${Math.abs(negativeDelta)} 条。`);
    }
    const versionRisk = page.diagnostics?.versionTrend
      .filter((item) => item.negativeCount > 0)
      .sort((a, b) => b.negativeShare - a.negativeShare)[0];
    if (versionRisk) {
      bullets.push(`版本 ${versionRisk.version} 的负面占比最高，为 ${versionRisk.negativeShare.toFixed(1)}%。`);
    }
    bullets.push(...(page.insights?.queryAngles || []).slice(0, 2));
    return NextResponse.json({ success: true, data: { bullets } });
  } catch (e) {
    console.error('ai-trends failed:', e);
    return NextResponse.json({ success: false, error: '生成失败' }, { status: 500 });
  }
}

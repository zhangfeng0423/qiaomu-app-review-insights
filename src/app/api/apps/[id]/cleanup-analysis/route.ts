import { NextRequest, NextResponse } from 'next/server';
import { ambiguousCachedPageResponse, resolveCachedPageForRequest } from '@/lib/appstore/request-page';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const resolution = await resolveCachedPageForRequest(request, id, 'write');
  if (resolution.status === 'ambiguous') return ambiguousCachedPageResponse(resolution);
  const page = resolution.page;
  if (!page) return NextResponse.json({ success: false, error: '应用不存在' }, { status: 404 });
  return NextResponse.json({
    success: true,
    data: { cleanedCount: 0, message: '统一研究缓存生成时已完成噪声过滤，无需单独清理。' },
  });
}

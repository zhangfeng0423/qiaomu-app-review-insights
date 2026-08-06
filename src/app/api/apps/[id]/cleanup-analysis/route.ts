import { NextRequest, NextResponse } from 'next/server';
import { findCachedReviewPage } from '@/lib/appstore/cache';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  void request;
  const { id } = await params;
  const page = await findCachedReviewPage(id);
  if (!page) return NextResponse.json({ success: false, error: '应用不存在' }, { status: 404 });
  return NextResponse.json({
    success: true,
    data: { cleanedCount: 0, message: '统一研究缓存生成时已完成噪声过滤，无需单独清理。' },
  });
}

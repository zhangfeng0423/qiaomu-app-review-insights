import { NextRequest, NextResponse } from 'next/server';
import { getCountryResearchComparison } from '@/lib/appstore/country-comparison';
import { ApiResponse } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse>> {
  const appId = request.nextUrl.searchParams.get('appId')?.trim() || '';
  if (!/^\d+$/.test(appId)) {
    return NextResponse.json({ success: false, error: '缺少有效 App ID' }, { status: 400 });
  }

  try {
    const comparison = await getCountryResearchComparison(appId);
    return NextResponse.json({ success: true, data: comparison });
  } catch (error) {
    console.error('Country comparison failed:', error);
    return NextResponse.json({ success: false, error: '多国家研究对比暂时不可用' }, { status: 500 });
  }
}

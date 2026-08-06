import { NextRequest, NextResponse } from 'next/server';
import {
  CachedAppReviewPage,
  resolveCachedReviewPage,
} from '@/lib/appstore/cache';
import type { CachedPageSelectionOperation, CachedPageSelectionResult } from '@/lib/appstore/cached-page-selection';

export async function resolveCachedPageForRequest(
  request: NextRequest,
  appId: string,
  operation: CachedPageSelectionOperation
): Promise<CachedPageSelectionResult<CachedAppReviewPage>> {
  const country = request.nextUrl.searchParams.get('country')?.trim() || undefined;
  return resolveCachedReviewPage(appId, { country, operation });
}

export function ambiguousCachedPageResponse(
  resolution: CachedPageSelectionResult<CachedAppReviewPage>
) {
  return NextResponse.json(
    {
      success: false,
      error: '同一个 App 存在多个国家/地区缓存，请在请求中补充 country 参数。',
      availableCountries: resolution.availableCountries,
    },
    { status: 409 }
  );
}

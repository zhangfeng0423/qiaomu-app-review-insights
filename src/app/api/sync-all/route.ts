import { NextRequest, NextResponse } from 'next/server';
import { getCachedAppSummaries, findCachedReviewPage, generateCachedReviewPage } from '@/lib/appstore/cache';

interface AppSyncResult {
  appId: string;
  appName: string;
  success: boolean;
  fetchResult?: { reviewCount: number; message: string };
  analysisResult?: { analyzedCount: number; message: string };
  error?: string;
  processingTime: number;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  try {
    const body = await request.json().catch(() => ({}));
    const maxConcurrentApps = Math.min(4, Math.max(1, Number(body.maxConcurrentApps) || 2));
    const apps = await getCachedAppSummaries();
    if (apps.length === 0) {
      return NextResponse.json({ success: true, data: {
        totalApps: 0, successfulApps: 0, failedApps: 0, totalNewReviews: 0, totalAnalyzedReviews: 0, appResults: [], totalTime: 0,
      }, message: '没有找到研究缓存' });
    }

    const appResults: AppSyncResult[] = [];
    for (let i = 0; i < apps.length; i += maxConcurrentApps) {
      const batch = apps.slice(i, i + maxConcurrentApps);
      const results = await Promise.all(batch.map(async (app) => {
        const appStart = Date.now();
        try {
          const existing = await findCachedReviewPage(app.id, app.country);
          const generated = await generateCachedReviewPage({ appId: app.id, country: app.country, incremental: true, analyze: true, force: true });
          const total = generated.page.stats.totalReviews;
          const analyzed = generated.page.insights ? total : 0;
          return {
            appId: app.id,
            appName: app.name,
            success: true,
            fetchResult: { reviewCount: Math.max(0, total - (existing?.stats.totalReviews || 0)), message: `当前共 ${total} 条评论` },
            analysisResult: { analyzedCount: analyzed, message: `已覆盖 ${analyzed} 条评论` },
            processingTime: Math.round((Date.now() - appStart) / 1000),
          } satisfies AppSyncResult;
        } catch (error) {
          return {
            appId: app.id,
            appName: app.name,
            success: false,
            error: error instanceof Error ? error.message : '同步失败',
            processingTime: Math.round((Date.now() - appStart) / 1000),
          } satisfies AppSyncResult;
        }
      }));
      appResults.push(...results);
    }

    const successfulApps = appResults.filter((result) => result.success).length;
    const totalNewReviews = appResults.reduce((sum, result) => sum + (result.fetchResult?.reviewCount || 0), 0);
    const totalAnalyzedReviews = appResults.reduce((sum, result) => sum + (result.analysisResult?.analyzedCount || 0), 0);
    const data = {
      totalApps: apps.length,
      successfulApps,
      failedApps: apps.length - successfulApps,
      totalNewReviews,
      totalAnalyzedReviews,
      appResults,
      totalTime: Math.round((Date.now() - startTime) / 1000),
    };
    return NextResponse.json({ success: true, data, message: `统一研究缓存同步完成：${successfulApps}/${apps.length} 个应用成功` });
  } catch (error) {
    console.error('Failed to perform global sync:', error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : '同步失败' }, { status: 500 });
  }
}

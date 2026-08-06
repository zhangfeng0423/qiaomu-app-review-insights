import { NextResponse } from 'next/server';
import { getCachedAppSummaries } from '@/lib/appstore/cache';
import { ApiResponse } from '@/types';

interface AppStats {
  totalReviews: number;
  averageRating: number;
  ratingDistribution: Record<string, number>;
  lastAnalyzed?: string;
  analysisProgress: number;
  lastFetched?: string;
}

// GET /api/apps/stats - 批量获取所有应用的统计信息
export async function GET(): Promise<NextResponse<ApiResponse<Record<string, AppStats>>>> {
  try {
    const apps = await getCachedAppSummaries();
    const stats: Record<string, AppStats> = {};
    apps.forEach((app) => {
      stats[app.id] = {
        totalReviews: app.totalReviews,
        averageRating: app.averageRating,
        ratingDistribution: {},
        lastAnalyzed: app.updatedAt,
        analysisProgress: 100,
      };
    });

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Failed to get apps stats:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: '获取应用统计信息失败',
      },
      { status: 500 }
    );
  }
}

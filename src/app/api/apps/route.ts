import { NextRequest, NextResponse } from 'next/server';
import { cachedPageToLegacyApp, getCachedAppSummaries, generateCachedReviewPage } from '@/lib/appstore/cache';
import { App, ApiResponse } from '@/types';

// GET /api/apps - 获取所有应用
export async function GET(): Promise<NextResponse<ApiResponse<{ apps: App[] }>>> {
  try {
    const apps = (await getCachedAppSummaries()).map((summary) => ({
      id: summary.id,
      name: summary.name,
      country: summary.country,
      lastFetched: summary.updatedAt,
    }));
    
    return NextResponse.json({
      success: true,
      data: { apps },
    });
  } catch (error) {
    console.error('Failed to get apps:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: '获取应用列表失败',
      },
      { status: 500 }
    );
  }
}

// POST /api/apps - 添加新应用
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<App>>> {
  try {
    const body = await request.json();
    const { id, name, country } = body;

    // 验证输入
    if (!id || !name || !country) {
      return NextResponse.json(
        {
          success: false,
          error: '应用 ID、名称和国家代码都是必需的',
        },
        { status: 400 }
      );
    }

    if (!/^\d+$/.test(id)) {
      return NextResponse.json(
        {
          success: false,
          error: '应用 ID 必须是数字',
        },
        { status: 400 }
      );
    }

    if (!/^[a-z]{2}$/.test(country)) {
      return NextResponse.json(
        {
          success: false,
          error: '国家代码必须是两位小写字母',
        },
        { status: 400 }
      );
    }

    const normalizedId = id.trim();
    const normalizedCountry = country.toLowerCase().trim();
    const existing = (await getCachedAppSummaries()).find((app) => app.id === normalizedId && app.country === normalizedCountry);
    if (existing) {
      return NextResponse.json({ success: true, data: {
        id: existing.id,
        name: existing.name,
        country: existing.country,
        lastFetched: existing.updatedAt,
      } satisfies App, message: '应用已在研究缓存中' });
    }

    const generated = await generateCachedReviewPage({
      appId: normalizedId,
      country: normalizedCountry,
      query: name.trim(),
      analyze: true,
    });
    const newApp = cachedPageToLegacyApp(generated.page);

    return NextResponse.json({
      success: true,
      data: newApp,
      message: '应用添加成功',
    });
  } catch (error) {
    console.error('Failed to create app:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: '添加应用失败',
      },
      { status: 500 }
    );
  }
}

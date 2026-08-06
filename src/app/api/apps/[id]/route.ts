import { NextRequest, NextResponse } from 'next/server';
import { cachedPageToLegacyApp, deleteCachedReviewPage, findCachedReviewPage, updateCachedReviewPageMetadata } from '@/lib/appstore/cache';
import { App, ApiResponse } from '@/types';

// GET /api/apps/[id] - 获取单个应用
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<App>>> {
  try {
    void request;
    const { id } = await params;
    const cachedPage = await findCachedReviewPage(id);
    if (cachedPage) {
      return NextResponse.json({
        success: true,
        data: cachedPageToLegacyApp(cachedPage),
      });
    }

    return NextResponse.json({ success: false, error: '应用不存在' }, { status: 404 });
  } catch (error) {
    console.error('Failed to get app:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: '获取应用失败',
      },
      { status: 500 }
    );
  }
}

// PUT /api/apps/[id] - 更新应用
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<App>>> {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, country } = body;

    // 验证输入
    if (!name || !country) {
      return NextResponse.json(
        {
          success: false,
          error: '应用名称和国家代码都是必需的',
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

    const currentPage = await findCachedReviewPage(id);
    if (!currentPage) {
      return NextResponse.json(
        {
          success: false,
          error: '应用不存在',
        },
        { status: 404 }
      );
    }

    const updatedPage = await updateCachedReviewPageMetadata(id, currentPage.app.country, {
      name: name.trim(),
      country: country.toLowerCase().trim(),
    });
    if (!updatedPage) return NextResponse.json({ success: false, error: '应用不存在' }, { status: 404 });
    const updatedApp = cachedPageToLegacyApp(updatedPage);

    return NextResponse.json({
      success: true,
      data: updatedApp,
      message: '应用更新成功',
    });
  } catch (error) {
    console.error('Failed to update app:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: '更新应用失败',
      },
      { status: 500 }
    );
  }
}

// DELETE /api/apps/[id] - 删除应用
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<null>>> {
  try {
    void request;
    const { id } = await params;
    const deleted = await deleteCachedReviewPage(id);
    if (!deleted) {
      return NextResponse.json(
        {
          success: false,
          error: '应用不存在',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: null,
      message: '应用删除成功',
    });
  } catch (error) {
    console.error('Failed to delete app:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: '删除应用失败',
      },
      { status: 500 }
    );
  }
}

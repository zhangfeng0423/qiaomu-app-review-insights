import { NextRequest, NextResponse } from 'next/server';
import { AnalysisResponse, KimiClient } from '@/lib/analysis/kimi-client';
import { ApiResponse } from '@/types';

// POST /api/prompts/test - 测试 Prompt 模板
export async function POST(
  request: NextRequest
): Promise<NextResponse<ApiResponse<{ result: AnalysisResponse }>>> {
  try {
    const body = await request.json();
    
    if (!body.prompt?.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Prompt 内容不能为空',
        },
        { status: 400 }
      );
    }

    if (!body.testData) {
      return NextResponse.json(
        {
          success: false,
          error: '测试数据不能为空',
        },
        { status: 400 }
      );
    }

    const { prompt, testData } = body;
    
    // 替换 Prompt 中的变量
    const processedPrompt = prompt
      .replace(/\{review_content\}/g, testData.content || '')
      .replace(/\{rating\}/g, testData.rating || '')
      .replace(/\{version\}/g, testData.version || '');

    console.log('Testing prompt with data:', { testData, processedPrompt: processedPrompt.substring(0, 100) + '...' });

    // 使用 Kimi API 进行测试
    const kimiClient = new KimiClient();
    const result = await kimiClient.analyzeReview(
      {
        title: testData.title || 'Prompt 测试评论',
        content: testData.content || '',
        rating: testData.rating || '',
        version: testData.version || '',
        authorName: testData.authorName || '',
        updated: testData.updated || '',
      },
      {
        id: 'prompt-test',
        name: 'Prompt 测试模板',
        description: '临时测试模板',
        content: processedPrompt,
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isActive: false,
      }
    );
    
    console.log('Prompt test result:', result);

    return NextResponse.json({
      success: true,
      data: { result },
      message: 'Prompt 测试成功',
    });
  } catch (error) {
    console.error('Failed to test prompt:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Prompt 测试失败';
    
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

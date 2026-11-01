import { NextRequest, NextResponse } from 'next/server';

function requiresAdmin(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method.toUpperCase();

  if (
    pathname === '/api/sync-all'
    || pathname === '/api/fetch-all'
    || pathname === '/api/analyze-all'
    || pathname.startsWith('/api/migrate-')
    || pathname === '/api/debug-db'
  ) return true;
  if (pathname.startsWith('/api/test-')) return true;
  if (pathname === '/api/translate') return true;
  // These legacy GET routes may call paid models on a cache miss.
  if (/^\/api\/apps\/[^/]+\/ai-(themes|trends|insights)$/.test(pathname)) return true;
  if (pathname === '/api/apps' && method !== 'GET') return true;
  if (pathname.startsWith('/api/apps/') && method !== 'GET') {
    return !pathname.endsWith('/reviews') && !pathname.endsWith('/stats') && !pathname.endsWith('/analysis') && !pathname.endsWith('/ai-themes') && !pathname.endsWith('/ai-trends') && !pathname.endsWith('/ai-insights') && !pathname.endsWith('/analyze-progress') && !pathname.endsWith('/export-report');
  }
  if (pathname === '/api/prompts' && method !== 'GET') return true;
  if (pathname.startsWith('/api/prompts/') && method !== 'GET') return true;
  return false;
}

function providedAdminToken(request: NextRequest) {
  const bearer = request.headers.get('authorization') || '';
  if (bearer.toLowerCase().startsWith('bearer ')) return bearer.slice(7).trim();
  return request.headers.get('x-admin-token') || '';
}

export function proxy(request: NextRequest) {
  if (!requiresAdmin(request)) return NextResponse.next();

  const configuredToken = process.env.QIAOMU_ADMIN_TOKEN || '';
  if (!configuredToken) {
    if (process.env.NODE_ENV !== 'production') return NextResponse.next();
    return NextResponse.json({ success: false, error: '管理接口未配置 QIAOMU_ADMIN_TOKEN' }, { status: 503 });
  }

  if (providedAdminToken(request) !== configuredToken) {
    return NextResponse.json({ success: false, error: '需要管理员凭证' }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};

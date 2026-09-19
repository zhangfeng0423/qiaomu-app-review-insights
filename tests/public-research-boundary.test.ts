import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

async function source(relativePath: string) {
  return readFile(path.join(process.cwd(), relativePath), 'utf8');
}

describe('public research boundaries', () => {
  it('keeps App detail GET rendering read-only when a cache is missing', async () => {
    const detailPage = await source('src/app/apps/[country]/[appId]/[[...slug]]/page.tsx');

    expect(detailPage).toContain('readCachedReviewPage');
    expect(detailPage).toContain('查看详情页不会自动抓取评论或调用 AI');
    expect(detailPage).not.toContain('generateCachedReviewPage');
  });

  it('routes both public generation mutations through the shared guard', async () => {
    const [researchRoute, regenerateRoute] = await Promise.all([
      source('src/app/api/research/route.ts'),
      source('src/app/api/research/regenerate/route.ts'),
    ]);

    expect(researchRoute).toContain('runGuardedPublicGeneration');
    expect(regenerateRoute).toContain('runGuardedPublicRefresh');
    expect(researchRoute).not.toContain('reservePublicGeneration(');
    expect(regenerateRoute).not.toContain('reservePublicRefresh(');
  });

  it('keeps discovery feeds out of the primary home-page request', async () => {
    const homePage = await source('src/app/page.tsx');

    expect(homePage).not.toContain('fetchTopChartApps');
    expect(homePage).not.toContain('fetchHackerNewsSignals');
    expect(homePage).toContain('initialQuery');
  });

  it('keeps legacy batch generation behind the admin boundary', async () => {
    const proxy = await source('src/proxy.ts');

    expect(proxy).toContain("pathname === '/api/fetch-all'");
    expect(proxy).toContain("pathname === '/api/analyze-all'");
  });
});

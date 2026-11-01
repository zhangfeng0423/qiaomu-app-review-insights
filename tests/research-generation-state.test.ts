import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { shouldGeneratePage } from '@/app/api/research/route';
import type { CachedAppReviewPage } from '@/lib/appstore/cache';

describe('research generation state', () => {
  it('does not treat a fresh review-only cache as a completed AI report', () => {
    const reviewOnlyPage = {
      insights: null,
      updatedAt: new Date().toISOString(),
    } as CachedAppReviewPage;

    expect(shouldGeneratePage(reviewOnlyPage, { force: false, freshDays: 3, analyze: false })).toBe(false);
    expect(shouldGeneratePage(reviewOnlyPage, { force: false, freshDays: 3, analyze: true })).toBe(true);
  });
});

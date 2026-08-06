import { describe, expect, it } from 'vitest';
import { selectCachedPage } from '@/lib/appstore/cached-page-selection';
import { detectResearchChanges } from '@/lib/appstore/research-history';
import type { ReviewHistorySnapshot } from '@/lib/appstore/review-history';

function snapshot(overrides: Partial<ReviewHistorySnapshot> = {}): ReviewHistorySnapshot {
  return {
    capturedAt: '2026-08-06T00:00:00.000Z',
    totalReviews: 20,
    averageRating: 4.2,
    negativeShare: 0.1,
    positiveShare: 0.75,
    ratingDistribution: { '1': 1, '2': 1, '3': 3, '4': 5, '5': 10 },
    versionTrend: [],
    issueThemes: [],
    ...overrides,
  };
}

function cachedPage(country: string, updatedAt: string) {
  return {
    app: {
      id: '123',
      country,
    },
    generatedAt: updatedAt,
    updatedAt,
  };
}

describe('cached research country resolution', () => {
  it('requires country for writes when the same App has multiple storefront caches', async () => {
    const pages = [cachedPage('us', '2026-08-06T00:00:00.000Z'), cachedPage('cn', '2026-08-05T00:00:00.000Z')];
    const ambiguous = selectCachedPage(pages, { operation: 'write' });
    const exact = selectCachedPage(pages, { country: 'cn', operation: 'write' });
    const readFallback = selectCachedPage(pages, { operation: 'read' });

    expect(ambiguous).toMatchObject({ status: 'ambiguous', page: null, availableCountries: ['cn', 'us'] });
    expect(exact).toMatchObject({ status: 'resolved', page: { app: { country: 'cn' } } });
    expect(readFallback).toMatchObject({ status: 'resolved', page: { app: { country: 'us' } } });
  });
});

describe('research history change detection', () => {
  it('flags a meaningful rating and negative-share regression', () => {
    const changes = detectResearchChanges([
      snapshot({ averageRating: 3.6, negativeShare: 0.28, capturedAt: '2026-08-06T00:00:00.000Z' }),
      snapshot({ averageRating: 4.2, negativeShare: 0.1, capturedAt: '2026-08-01T00:00:00.000Z' }),
    ]);

    expect(changes.map((change) => change.type)).toEqual(expect.arrayContaining(['rating-drop', 'negative-spike']));
  });

  it('does not emit changes when only one snapshot exists', () => {
    expect(detectResearchChanges([snapshot()])).toEqual([]);
  });
});

import 'server-only';

import { promises as fs } from 'fs';
import path from 'path';
import { AppStoreLookupResult, normalizeCountry } from '@/lib/appstore/discovery';
import { ReviewDiagnostics, buildReviewDiagnostics } from '@/lib/appstore/diagnostics';
import { ReviewStats, summarizeReviews } from '@/lib/appstore/review-summary';
import { AppStoreReview } from '@/types';

export interface ReviewHistoryVersionSnapshot {
  version: string;
  reviewCount: number;
  averageRating: number;
  negativeShare: number;
  positiveShare: number;
}

export interface ReviewHistoryThemeSnapshot {
  key: string;
  label: string;
  count: number;
  share: number;
}

export interface ReviewHistorySnapshot {
  capturedAt: string;
  sourceUpdatedAt?: string;
  totalReviews: number;
  averageRating: number;
  negativeShare: number;
  positiveShare: number;
  ratingDistribution: Record<string, number>;
  versionTrend: ReviewHistoryVersionSnapshot[];
  issueThemes: ReviewHistoryThemeSnapshot[];
}

export interface ReviewHistoryOptions {
  sourceUpdatedAt?: string;
  diagnostics?: ReviewDiagnostics;
}

interface ReviewHistoryFile {
  version: 1;
  app: Pick<AppStoreLookupResult, 'id' | 'name' | 'country' | 'artistName' | 'artworkUrl' | 'trackViewUrl' | 'primaryGenreName'>;
  firstSeenAt: string;
  lastSeenAt: string;
  totalReviews: number;
  reviews: AppStoreReview[];
  snapshots?: ReviewHistorySnapshot[];
}

function historyRoot() {
  return process.env.APP_REVIEW_HISTORY_DIR
    || path.join(
      process.env.APP_REVIEW_CACHE_DIR || path.join(process.cwd(), 'src', 'data', 'app-cache'),
      '.review-history'
    );
}

function safeHistoryKey(country: string, appId: string) {
  return `${normalizeCountry(country)}-${appId.replace(/\D/g, '')}`;
}

function historyFilePath(country: string, appId: string) {
  return path.join(historyRoot(), `${safeHistoryKey(country, appId)}.json`);
}

function sortReviewsByDateDesc(reviews: AppStoreReview[]) {
  return [...reviews].sort((a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime());
}

async function readHistory(country: string, appId: string): Promise<ReviewHistoryFile | null> {
  try {
    const content = await fs.readFile(historyFilePath(country, appId), 'utf8');
    return JSON.parse(content) as ReviewHistoryFile;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

function buildSnapshot(
  reviews: AppStoreReview[],
  options: ReviewHistoryOptions = {}
): ReviewHistorySnapshot {
  const stats: ReviewStats = summarizeReviews(reviews);
  const diagnostics = options.diagnostics || buildReviewDiagnostics(reviews);
  const themeCounts = new Map<string, { label: string; count: number }>();

  for (const cell of diagnostics.issueHeatmap) {
    const existing = themeCounts.get(cell.themeKey) || { label: cell.themeLabel, count: 0 };
    existing.count += cell.count;
    themeCounts.set(cell.themeKey, existing);
  }

  return {
    capturedAt: new Date().toISOString(),
    sourceUpdatedAt: options.sourceUpdatedAt,
    totalReviews: stats.totalReviews,
    averageRating: stats.averageRating,
    negativeShare: stats.negativeShare,
    positiveShare: stats.positiveShare,
    ratingDistribution: stats.ratingDistribution,
    versionTrend: diagnostics.versionTrend.map((item) => ({
      version: item.version,
      reviewCount: item.reviewCount,
      averageRating: item.averageRating,
      negativeShare: item.negativeShare,
      positiveShare: item.positiveShare,
    })),
    issueThemes: diagnostics.issueThemes.map((theme) => {
      const count = themeCounts.get(theme.key)?.count || 0;
      return {
        key: theme.key,
        label: theme.label,
        count,
        share: stats.totalReviews ? Number((count / stats.totalReviews).toFixed(3)) : 0,
      };
    }),
  };
}

async function atomicWriteJson(filePath: string, data: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmpPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  await fs.rename(tmpPath, filePath);
}

export async function upsertReviewHistory(
  app: AppStoreLookupResult,
  reviews: AppStoreReview[],
  options: ReviewHistoryOptions = {}
) {
  if (reviews.length === 0) return;

  const country = normalizeCountry(app.country);
  const existing = await readHistory(country, app.id);
  const byId = new Map<string, AppStoreReview>();

  for (const review of existing?.reviews || []) {
    byId.set(review.id, review);
  }

  for (const review of reviews) {
    byId.set(review.id, {
      ...review,
      appId: review.appId || app.id,
      country: normalizeCountry(review.country || country),
      sourceCountry: review.sourceCountry ? normalizeCountry(review.sourceCountry) : country,
    });
  }

  const now = new Date().toISOString();
  const snapshot = buildSnapshot(reviews, options);
  const existingSnapshots = existing?.snapshots || [];
  const snapshotKey = snapshot.sourceUpdatedAt || snapshot.capturedAt;
  const snapshots = [
    snapshot,
    ...existingSnapshots.filter((item) => (item.sourceUpdatedAt || item.capturedAt) !== snapshotKey),
  ].slice(0, 24);
  const mergedReviews = sortReviewsByDateDesc(Array.from(byId.values()));
  const history: ReviewHistoryFile = {
    version: 1,
    app: {
      id: app.id,
      name: app.name,
      country,
      artistName: app.artistName,
      artworkUrl: app.artworkUrl,
      trackViewUrl: app.trackViewUrl,
      primaryGenreName: app.primaryGenreName,
    },
    firstSeenAt: existing?.firstSeenAt || now,
    lastSeenAt: now,
    totalReviews: mergedReviews.length,
    reviews: mergedReviews,
    snapshots,
  };

  await atomicWriteJson(historyFilePath(country, app.id), history);
}

export async function getReviewHistory(country: string, appId: string, limit = 12) {
  const history = await readHistory(normalizeCountry(country), appId);
  const snapshots = history?.snapshots?.length
    ? history.snapshots
    : history?.reviews?.length
      ? [buildSnapshot(history.reviews, { sourceUpdatedAt: history.lastSeenAt })]
      : [];
  return snapshots.slice(0, Math.max(1, Math.min(limit, 24)));
}

import { AppStoreReview } from '@/types';

export type ReviewQualityFlag = 'short' | 'emoji-heavy' | 'repeated' | 'spam-like';

export interface ReviewCluster {
  clusterId: string;
  representative: AppStoreReview;
  reviewIds: string[];
  uniqueReviewerCount: number;
  count: number;
  averageRating: number;
  versions: string[];
  qualityScore: number;
  flags: ReviewQualityFlag[];
  reviewerKeys: string[];
}

function reviewText(review: AppStoreReview) {
  return `${review.title || ''} ${review.content || ''}`.replace(/\s+/g, ' ').trim();
}

export function normalizeReviewText(value: string) {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .replace(/([!?！？。．])\1+/g, '$1')
    .replace(/[\p{Extended_Pictographic}]/gu, '🙂')
    .replace(/[\s\p{P}\p{S}]+/gu, '')
    .trim();
}

function characterBigrams(value: string) {
  const text = normalizeReviewText(value);
  if (text.length < 2) return new Set([text]);
  return new Set(Array.from({ length: text.length - 1 }, (_, index) => text.slice(index, index + 2)));
}

function jaccard(left: Set<string>, right: Set<string>) {
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const item of left) if (right.has(item)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
}

function flagsFor(review: AppStoreReview): ReviewQualityFlag[] {
  const text = reviewText(review);
  const normalized = normalizeReviewText(text);
  const flags: ReviewQualityFlag[] = [];
  const emojiCount = (text.match(/[\p{Extended_Pictographic}]/gu) || []).length;
  const repeatedCount = (text.match(/(.)\1{3,}/gu) || []).join('').length;

  if (Array.from(normalized).length < 6) flags.push('short');
  if (emojiCount >= 5 || emojiCount / Math.max(text.length, 1) > 0.45) flags.push('emoji-heavy');
  if (repeatedCount >= 4 || /(啊|哈|呵|嗯|哦|！|!|？|\?){4,}/u.test(text)) flags.push('repeated');
  if (/(加微|微信|vx|qq群|兼职|刷单|返现|博彩|色情|开户链接)/iu.test(text)) flags.push('spam-like');

  return flags;
}

function qualityScore(review: AppStoreReview, flags: ReviewQualityFlag[]) {
  const length = Array.from(reviewText(review)).length;
  let score = Math.min(1, 0.45 + Math.min(length, 160) / 320);
  if (flags.includes('short')) score -= 0.12;
  if (flags.includes('emoji-heavy')) score -= 0.12;
  if (flags.includes('repeated')) score -= 0.18;
  if (flags.includes('spam-like')) score -= 0.65;
  return Math.max(0, Math.min(1, score));
}

function isBetterRepresentative(candidate: AppStoreReview, current: AppStoreReview) {
  const candidateLength = Array.from(reviewText(candidate)).length;
  const currentLength = Array.from(reviewText(current)).length;
  const candidateFlags = flagsFor(candidate);
  const currentFlags = flagsFor(current);
  return qualityScore(candidate, candidateFlags) > qualityScore(current, currentFlags)
    || (qualityScore(candidate, candidateFlags) === qualityScore(current, currentFlags) && candidateLength > currentLength);
}

function clusterMatches(cluster: ReviewCluster, review: AppStoreReview) {
  const normalized = normalizeReviewText(reviewText(review));
  const representativeNormalized = normalizeReviewText(reviewText(cluster.representative));
  if (normalized && normalized === representativeNormalized) return true;
  if (normalized.length < 18 || representativeNormalized.length < 18) return false;
  return jaccard(characterBigrams(normalized), characterBigrams(representativeNormalized)) >= 0.9;
}

export function prepareReviewCorpus(reviews: AppStoreReview[]): ReviewCluster[] {
  const clusters: ReviewCluster[] = [];

  for (const review of reviews) {
    const flags = flagsFor(review);
    const match = clusters.find((cluster) => clusterMatches(cluster, review));
    if (match) {
      match.reviewIds.push(review.id);
      match.count += 1;
      match.averageRating = (match.averageRating * (match.count - 1) + Number(review.rating || 0)) / match.count;
      if (review.authorName && !match.reviewerKeys.includes(review.authorName)) {
        match.reviewerKeys.push(review.authorName);
        match.uniqueReviewerCount += 1;
      }
      if (review.version && !match.versions.includes(review.version)) match.versions.push(review.version);
      if (isBetterRepresentative(review, match.representative)) {
        match.representative = review;
        match.qualityScore = qualityScore(review, flags);
        match.flags = flags;
      }
      continue;
    }

    clusters.push({
      clusterId: `cluster_${clusters.length + 1}`,
      representative: review,
      reviewIds: [review.id],
      uniqueReviewerCount: review.authorName ? 1 : 0,
      count: 1,
      averageRating: Number(review.rating || 0),
      versions: review.version ? [review.version] : [],
      qualityScore: qualityScore(review, flags),
      flags,
      reviewerKeys: review.authorName ? [review.authorName] : [],
    });
  }

  return clusters.sort((left, right) => {
    const leftPriority = left.count * 0.6 + left.qualityScore * 2;
    const rightPriority = right.count * 0.6 + right.qualityScore * 2;
    return rightPriority - leftPriority;
  });
}

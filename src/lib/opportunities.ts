import { listCachedReviewPages, CachedAppReviewPage } from '@/lib/appstore/cache';
import { normalizeReviewText, prepareReviewCorpus } from '@/lib/analysis/review-preprocessor';

export interface AgentProfile {
  name: string;
  mission: string;
  strengths: string[];
  constraints: string[];
}

export interface EvidenceReview {
  id: string;
  title: string;
  content: string;
  rating: string;
  version: string;
  updated: string;
  authorName?: string;
}

export interface RelatedOpportunityApp {
  id: string;
  name: string;
  country: string;
  pagePath: string;
  title: string;
  evidenceCount: number;
  similarity: number;
}

export interface OpportunityCandidate {
  id: string;
  title: string;
  summary: string;
  evidence: string;
  sourceApp: {
    id: string;
    name: string;
    country: string;
    genre?: string;
    pagePath: string;
  };
  category: string;
  priority: 'high' | 'medium' | 'low';
  evidenceCount: number;
  evidenceClusterCount: number;
  evidenceStatus: 'supported' | 'weak';
  confidence: number;
  confidenceReasons: string[];
  evidenceReviews: EvidenceReview[];
  crossAppAppCount: number;
  crossAppEvidenceCount: number;
  relatedApps: RelatedOpportunityApp[];
  evidenceGaps: string[];
  score: number;
  scoreBreakdown: {
    need: number;
    evidence: number;
    buildability: number;
    fit: number;
  };
  signal: string;
}

export const defaultAgentProfile: AgentProfile = {
  name: '你的产品 Agent',
  mission: '发现真实用户需求，制造小而有用的 Web App',
  strengths: ['AI 工作流', '快速原型', '中文产品体验'],
  constraints: ['先做 Web App', '小团队可维护', '发布前人工确认'],
};

function scorePriority(priority?: string) {
  if (priority === 'high') return 95;
  if (priority === 'low') return 55;
  return 75;
}

function clean(value: unknown, fallback: string) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text || fallback;
}

function makeId(appId: string, title: string, index: number) {
  return `opp_${appId}_${index}_${title.slice(0, 18).replace(/\W/g, '')}`;
}

function extractEvidenceReviews(page: CachedAppReviewPage, item: { evidence?: string; reviewIds?: string[] }) {
  const reviews = page.allReviews?.length ? page.allReviews : page.reviews;
  const reviewIds = new Set(item.reviewIds || []);
  let matches = reviews.filter((review) => reviewIds.has(review.id));

  if (matches.length === 0 && item.evidence) {
    const evidence = item.evidence.replace(/[“”"']/g, '').trim();
    const terms = evidence.split(/\s+/).filter((term) => term.length >= 2).slice(0, 5);
    matches = reviews.filter((review) => {
      const text = `${review.title} ${review.content}`;
      return terms.length > 0 && terms.every((term) => text.includes(term));
    });
  }

  return matches.slice(0, 6).map((review): EvidenceReview => ({
    id: review.id,
    title: review.title,
    content: review.content,
    rating: review.rating,
    version: review.version,
    updated: review.updated,
    authorName: review.authorName,
  }));
}

function countEvidenceClusters(page: CachedAppReviewPage, reviewIds: string[]) {
  if (reviewIds.length === 0) return 0;
  const reviews = page.allReviews?.length ? page.allReviews : page.reviews;
  const idSet = new Set(reviewIds);
  return prepareReviewCorpus(reviews)
    .filter((cluster) => cluster.reviewIds.some((id) => idSet.has(id)))
    .length;
}

function candidateFromItem(
  page: CachedAppReviewPage,
  item: { title?: string; summary?: string; evidence?: string; priority?: 'high' | 'medium' | 'low'; reviewIds?: string[] },
  index: number,
  kind: 'opportunity' | 'pain'
): OpportunityCandidate {
  const priority = item.priority || 'medium';
  const title = clean(item.title, kind === 'pain' ? '修复用户反复遇到的核心问题' : '围绕用户缺口设计轻量工具');
  const summary = clean(item.summary, '从用户表达中提炼出的待验证产品机会。');
  const evidence = clean(item.evidence, '当前洞察未保留代表性证据，建议回到评论原文复核。');
  const need = Math.round(scorePriority(priority));
  const evidenceCount = item.reviewIds?.length || 0;
  const evidenceClusterCount = countEvidenceClusters(page, item.reviewIds || []);
  const evidenceStatus = evidenceClusterCount >= 2 ? 'supported' : 'weak';
  const evidenceScore = evidenceStatus === 'supported' && !evidence.includes('未保留') ? 92 : 42;
  const evidenceReviews = extractEvidenceReviews(page, item);
  const uniqueReviewers = new Set(evidenceReviews.map((review) => review.authorName).filter(Boolean)).size;
  const versions = new Set(evidenceReviews.map((review) => review.version).filter(Boolean)).size;
  const confidenceReasons = [
    `${evidenceCount || evidenceReviews.length} 条评论证据，归并为 ${evidenceClusterCount} 个相似评论簇`,
    uniqueReviewers > 0 ? `${uniqueReviewers} 位可识别用户` : '用户身份未完整保留',
    versions > 1 ? `涉及 ${versions} 个版本` : '暂未形成跨版本证据',
    evidenceReviews.length > 0 ? '可回溯原始评论' : '暂未找到可回溯原文',
  ]; 
  const evidenceGaps = [
    evidenceClusterCount < 2 ? '评论簇数量少于 2 个，可能是单个用户或重复表达' : '',
    uniqueReviewers === 0 ? '用户身份未完整保留，无法确认是否来自不同用户' : '',
    versions <= 1 ? '暂未形成跨版本证据，无法判断是否为长期问题' : '',
    evidenceReviews.length === 0 ? '暂时无法回溯原始评论' : '',
    '目前只有单一 App 证据，尚未验证跨产品重复出现',
  ].filter(Boolean);
  const confidence = Math.min(
    90,
    Math.max(
      evidenceStatus === 'supported' ? 45 : 25,
      25 + Math.min(evidenceClusterCount, 8) * 6 + Math.min(uniqueReviewers, 5) * 4 + (versions > 1 ? 8 : 0) + (evidenceReviews.length > 0 ? 10 : 0)
    )
  );
  const buildability = kind === 'pain' ? 78 : 82;
  const fit = 84;
  const score = Math.round(need * 0.35 + evidenceScore * 0.3 + buildability * 0.2 + fit * 0.15);

  return {
    id: makeId(page.app.id, title, index),
    title: kind === 'pain' ? `解决：${title}` : title,
    summary,
    evidence,
    sourceApp: {
      id: page.app.id,
      name: page.app.name,
      country: page.app.country,
      genre: page.app.primaryGenreName,
      pagePath: page.pagePath,
    },
    category: page.app.primaryGenreName || '未分类',
    priority,
    evidenceCount,
    evidenceClusterCount,
    evidenceStatus,
    confidence,
    confidenceReasons,
    evidenceReviews,
    crossAppAppCount: 0,
    crossAppEvidenceCount: 0,
    relatedApps: [],
    evidenceGaps,
    score,
    scoreBreakdown: { need, evidence: evidenceScore, buildability, fit },
    signal: evidenceStatus === 'supported'
      ? (kind === 'pain' ? `来自 ${evidenceCount} 条评论 · ${evidenceClusterCount} 个评论簇` : `来自 ${evidenceCount} 条评论建议 · ${evidenceClusterCount} 个评论簇`)
      : '证据不足，待人工验证',
  };
}

function candidateTokens(candidate: OpportunityCandidate) {
  const text = normalizeReviewText(`${candidate.title} ${candidate.summary} ${candidate.evidence}`)
    .replace(/用户|评论|产品|功能|体验|问题|需求|支持|应用|希望|可以|一个|这个/g, '');
  if (text.length < 2) return new Set<string>();
  return new Set(Array.from({ length: text.length - 1 }, (_, index) => text.slice(index, index + 2)));
}

function candidateSimilarity(left: OpportunityCandidate, right: OpportunityCandidate) {
  const leftTokens = candidateTokens(left);
  const rightTokens = candidateTokens(right);
  if (!leftTokens.size || !rightTokens.size) return 0;
  let intersection = 0;
  for (const token of leftTokens) if (rightTokens.has(token)) intersection += 1;
  return intersection / Math.min(leftTokens.size, rightTokens.size);
}

function enrichAcrossApps(candidates: OpportunityCandidate[]) {
  return candidates.map((candidate) => {
    const relatedByApp = new Map<string, RelatedOpportunityApp>();

    for (const other of candidates) {
      if (other.id === candidate.id || other.sourceApp.id === candidate.sourceApp.id) continue;
      const similarity = candidateSimilarity(candidate, other);
      if (similarity < 0.28) continue;
      const current = relatedByApp.get(other.sourceApp.id);
      if (!current || similarity > current.similarity) {
        relatedByApp.set(other.sourceApp.id, {
          id: other.sourceApp.id,
          name: other.sourceApp.name,
          country: other.sourceApp.country,
          pagePath: other.sourceApp.pagePath,
          title: other.title,
          evidenceCount: other.evidenceCount || other.evidenceReviews.length,
          similarity: Number(similarity.toFixed(2)),
        });
      }
    }

    const relatedApps = Array.from(relatedByApp.values()).sort((left, right) => right.similarity - left.similarity).slice(0, 5);
    const crossAppAppCount = relatedApps.length;
    const crossAppEvidenceCount = relatedApps.reduce((sum, item) => sum + Math.max(item.evidenceCount, 1), 0);
    const evidenceGaps = candidate.evidenceGaps.filter((gap) => !gap.startsWith('目前只有单一 App'));

    if (crossAppAppCount === 0) {
      evidenceGaps.push('目前只有单一 App 证据，尚未验证跨产品重复出现');
    } else if (crossAppAppCount === 1) {
      evidenceGaps.push('仅在另一个 App 中出现，仍需扩大竞品样本');
    }

    const crossAppBonus = Math.min(15, crossAppAppCount * 6);
    const evidence = Math.min(100, candidate.scoreBreakdown.evidence + crossAppBonus);
    const confidence = Math.min(95, candidate.confidence + crossAppBonus);
    const score = Math.round(
      candidate.scoreBreakdown.need * 0.35
      + evidence * 0.3
      + candidate.scoreBreakdown.buildability * 0.2
      + candidate.scoreBreakdown.fit * 0.15
    );

    return {
      ...candidate,
      crossAppAppCount,
      crossAppEvidenceCount,
      relatedApps,
      evidenceGaps,
      confidence,
      score,
      scoreBreakdown: { ...candidate.scoreBreakdown, evidence },
      confidenceReasons: [
        ...candidate.confidenceReasons,
        crossAppAppCount > 0 ? `在 ${crossAppAppCount} 个其他 App 中发现相似信号，共补充 ${crossAppEvidenceCount} 条证据` : '尚未发现其他 App 的相似信号',
      ],
      signal: crossAppAppCount > 0
        ? `${candidate.signal} · 跨 ${crossAppAppCount} 个 App 重复出现`
        : candidate.signal,
    };
  });
}

export async function getOpportunityCandidates(limit = 30) {
  const pages = await listCachedReviewPages();
  const candidates = pages.flatMap((page) => {
    const insights = page.insights;
    const opportunities = (insights?.opportunities || []).map((item, index) =>
      candidateFromItem(page, item, index, 'opportunity')
    );

    if (opportunities.length > 0) return opportunities;

    return (insights?.painPoints || []).map((item, index) => candidateFromItem(page, item, index, 'pain'));
  });

  return enrichAcrossApps(candidates).sort((a, b) => b.score - a.score).slice(0, limit);
}

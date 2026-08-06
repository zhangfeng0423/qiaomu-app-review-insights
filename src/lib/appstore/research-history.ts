import type { ReviewHistorySnapshot } from '@/lib/appstore/review-history';

export type ResearchChangeSeverity = 'high' | 'medium' | 'low';
export type ResearchChangeType = 'rating-drop' | 'negative-spike' | 'new-theme' | 'version-risk';

export interface ResearchChange {
  id: string;
  type: ResearchChangeType;
  severity: ResearchChangeSeverity;
  title: string;
  summary: string;
  currentValue: string;
  previousValue: string;
  delta?: number;
}

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function severityFor(delta: number, high: number, medium: number): ResearchChangeSeverity {
  if (Math.abs(delta) >= high) return 'high';
  if (Math.abs(delta) >= medium) return 'medium';
  return 'low';
}

export function detectResearchChanges(snapshots: ReviewHistorySnapshot[]): ResearchChange[] {
  if (snapshots.length < 2) return [];

  const current = snapshots[0];
  const previous = snapshots[1];
  const changes: ResearchChange[] = [];
  const ratingDelta = Number((current.averageRating - previous.averageRating).toFixed(2));
  const negativeDelta = Number((current.negativeShare - previous.negativeShare).toFixed(3));

  if (ratingDelta <= -0.2) {
    changes.push({
      id: 'rating-drop',
      type: 'rating-drop',
      severity: severityFor(ratingDelta, 0.5, 0.3),
      title: '样本均分下滑',
      summary: `当前样本均分较上次下降 ${Math.abs(ratingDelta).toFixed(2)} 分，建议结合版本和评论正文回查。`,
      currentValue: `${current.averageRating} / 5`,
      previousValue: `${previous.averageRating} / 5`,
      delta: ratingDelta,
    });
  }

  if (negativeDelta >= 0.08) {
    changes.push({
      id: 'negative-spike',
      type: 'negative-spike',
      severity: severityFor(negativeDelta, 0.2, 0.12),
      title: '差评占比上升',
      summary: `差评占比较上次上升 ${Math.round(negativeDelta * 100)} 个百分点，可能对应更新、故障或策略变化。`,
      currentValue: percent(current.negativeShare),
      previousValue: percent(previous.negativeShare),
      delta: negativeDelta,
    });
  }

  const previousThemes = new Map((previous.issueThemes || []).map((theme) => [theme.key, theme]));
  for (const theme of current.issueThemes || []) {
    const oldTheme = previousThemes.get(theme.key);
    if (theme.count >= 2 && (!oldTheme || oldTheme.count === 0) && theme.share >= 0.02) {
      changes.push({
        id: `new-theme-${theme.key}`,
        type: 'new-theme',
        severity: theme.count >= 5 ? 'high' : 'medium',
        title: `新增集中痛点：${theme.label}`,
        summary: `本次样本中出现 ${theme.count} 条相关评论，之前快照没有形成该主题证据。`,
        currentValue: `${theme.count} 条`,
        previousValue: `${oldTheme?.count || 0} 条`,
        delta: theme.count - (oldTheme?.count || 0),
      });
    }
  }

  const currentRisk = [...(current.versionTrend || [])]
    .filter((item) => item.reviewCount >= 3)
    .sort((left, right) => right.negativeShare - left.negativeShare)[0];
  const previousRisk = currentRisk
    ? (previous.versionTrend || []).find((item) => item.version === currentRisk.version)
    : undefined;
  if (currentRisk && currentRisk.negativeShare >= 45 && (!previousRisk || currentRisk.negativeShare - previousRisk.negativeShare >= 12)) {
    changes.push({
      id: `version-risk-${currentRisk.version}`,
      type: 'version-risk',
      severity: currentRisk.negativeShare >= 65 ? 'high' : 'medium',
      title: `版本风险：${currentRisk.version}`,
      summary: `${currentRisk.version} 的差评占比达到 ${currentRisk.negativeShare}%，建议核对该版本上线后的变化。`,
      currentValue: `${currentRisk.negativeShare}% 差评`,
      previousValue: previousRisk ? `${previousRisk.negativeShare}% 差评` : '之前没有该版本样本',
      delta: currentRisk.negativeShare - (previousRisk?.negativeShare || 0),
    });
  }

  return changes.sort((left, right) => {
    const rank = { high: 3, medium: 2, low: 1 };
    return rank[right.severity] - rank[left.severity];
  }).slice(0, 6);
}

import { AlertTriangle, ArrowDownRight, History, Minus, Sparkles } from 'lucide-react';
import type { ResearchChange } from '@/lib/appstore/research-history';
import type { ReviewHistorySnapshot } from '@/lib/appstore/review-history';

function formatDate(value?: string) {
  if (!value) return '未知时间';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '未知时间';
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date);
}

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function severityStyle(severity: ResearchChange['severity']) {
  if (severity === 'high') return 'border-rose-200 bg-rose-50 text-rose-800';
  if (severity === 'medium') return 'border-amber-200 bg-amber-50 text-amber-800';
  return 'border-zinc-200 bg-zinc-50 text-zinc-700';
}

export function ResearchHistoryPanel({
  snapshots,
  changes,
}: {
  snapshots: ReviewHistorySnapshot[];
  changes: ResearchChange[];
}) {
  const current = snapshots[0];
  const previous = snapshots[1];

  return (
    <section className="mx-auto max-w-7xl px-4 pb-6 sm:px-6 lg:px-8">
      <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-teal-700">
              <History className="h-4 w-4" />
              Research History
            </div>
            <h2 className="mt-2 text-xl font-semibold text-zinc-950">研究快照与变化</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
              每次成功更新都会保存一份统计快照，用来识别评分、差评占比、主题和版本风险的变化；快照不重复保存评论正文。
            </p>
          </div>
          <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-500">
            {snapshots.length} 次快照
          </span>
        </div>

        {changes.length > 0 ? (
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {changes.map((change) => (
              <article key={change.id} className={`rounded-lg border p-4 ${severityStyle(change.severity)}`}>
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold">{change.title}</h3>
                      <span className="rounded-full border border-current/20 px-2 py-0.5 text-[11px]">{change.severity === 'high' ? '高优先级' : change.severity === 'medium' ? '需关注' : '轻微变化'}</span>
                    </div>
                    <p className="mt-2 text-sm leading-6 opacity-80">{change.summary}</p>
                    <p className="mt-3 text-xs opacity-70">{change.previousValue} → {change.currentValue}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-5 flex items-start gap-3 rounded-lg border border-teal-100 bg-teal-50/60 p-4">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" />
            <p className="text-sm leading-6 text-teal-800">
              {previous ? '与上一份快照相比，暂未发现达到提醒阈值的明显变化。' : '这是第一份快照；下一次更新后会开始显示变化检测。'}
            </p>
          </div>
        )}

        {current ? (
          <div className="mt-5 overflow-x-auto rounded-lg border border-zinc-100">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-zinc-50 text-xs text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-medium">快照时间</th>
                  <th className="px-4 py-3 font-medium">样本</th>
                  <th className="px-4 py-3 font-medium">均分</th>
                  <th className="px-4 py-3 font-medium">差评占比</th>
                  <th className="px-4 py-3 font-medium">主导主题</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {snapshots.slice(0, 8).map((snapshot, index) => {
                  const dominantTheme = [...snapshot.issueThemes].sort((left, right) => right.count - left.count)[0];
                  return (
                    <tr key={`${snapshot.capturedAt}-${index}`} className={index === 0 ? 'bg-teal-50/40' : 'bg-white'}>
                      <td className="whitespace-nowrap px-4 py-3 text-zinc-600" suppressHydrationWarning>{formatDate(snapshot.capturedAt)}</td>
                      <td className="px-4 py-3 text-zinc-700">{snapshot.totalReviews}</td>
                      <td className="px-4 py-3 font-medium text-zinc-900">{snapshot.averageRating} <span className="text-xs font-normal text-zinc-400">/ 5</span></td>
                      <td className="px-4 py-3 text-rose-600">{percent(snapshot.negativeShare)}</td>
                      <td className="px-4 py-3 text-zinc-600">{dominantTheme?.label || '暂无主题'}{dominantTheme?.count ? ` · ${dominantTheme.count} 条` : ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-5 flex items-center gap-2 text-sm text-zinc-500"><Minus className="h-4 w-4" />暂无历史快照</div>
        )}

        {previous && current ? (
          <div className="mt-4 flex flex-wrap gap-3 text-xs text-zinc-500">
            <span className="inline-flex items-center gap-1 rounded-full bg-zinc-50 px-2.5 py-1"><ArrowDownRight className="h-3.5 w-3.5 text-rose-500" />评分变化 {(current.averageRating - previous.averageRating).toFixed(2)}</span>
            <span className="rounded-full bg-zinc-50 px-2.5 py-1">样本变化 {current.totalReviews - previous.totalReviews >= 0 ? '+' : ''}{current.totalReviews - previous.totalReviews}</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowUpRight, CheckCircle2, CircleHelp, FileSearch, Globe2, ShieldCheck, Sparkles } from 'lucide-react';
import Link from 'next/link';
import type { AgentProfile, OpportunityCandidate } from '@/lib/opportunities';

function buildBrief(candidate: OpportunityCandidate) {
  return {
    audience: `正在使用「${candidate.sourceApp.name}」或同类产品、并受此问题影响的用户`,
    wedge: '围绕这个问题继续收集证据，确认它是普遍需求、版本事故，还是少数用户的个别诉求。',
    features: [
      '回溯原始评论并核对证据范围',
      '对比版本、评分和用户数量变化',
      '记录仍需验证的研究问题',
    ],
    validation: `找 5 位有类似经历的用户，确认他们是否愿意在一周内使用这个解决方案。`,
    prompt: `请基于以下产品机会生成一份研究 Brief，不要直接生成产品：\n\n${candidate.title}\n${candidate.summary}\n目标用户：${candidate.sourceApp.name} 的相关用户\n证据：${candidate.evidence}\n请列出：证据边界、待验证假设、需要补采的数据，以及可能的反例。`,
  };
}

function scoreColor(score: number) {
  if (score >= 80) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (score >= 65) return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-zinc-100 text-zinc-600 border-zinc-200';
}

function confidenceColor(confidence: number) {
  if (confidence >= 75) return 'bg-teal-50 text-teal-700 border-teal-200';
  if (confidence >= 55) return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-zinc-100 text-zinc-600 border-zinc-200';
}

export default function OpportunityWorkbench({
  candidates,
  profile,
}: {
  candidates: OpportunityCandidate[];
  profile: AgentProfile;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const visibleCandidates = useMemo(() => showAll ? candidates : candidates.slice(0, 6), [candidates, showAll]);
  const selected = candidates.find((candidate) => candidate.id === selectedId) || null;
  const brief = selected ? buildBrief(selected) : null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="h-fit rounded-xl border border-zinc-200 bg-white p-5 shadow-sm lg:sticky lg:top-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-950">
            <Sparkles className="h-4 w-4 text-teal-600" />
            {profile.name}
          </div>
          <p className="mt-3 text-sm leading-6 text-zinc-600">{profile.mission}</p>
          <div className="mt-5">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-400">Agent 优势</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {profile.strengths.map((item) => <span key={item} className="rounded-full bg-teal-50 px-2.5 py-1 text-xs text-teal-700">{item}</span>)}
            </div>
          </div>
          <div className="mt-5">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-400">研究约束</p>
            <ul className="mt-2 space-y-2 text-sm text-zinc-600">
              {profile.constraints.map((item) => <li key={item} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{item}</li>)}
            </ul>
          </div>
          <div className="mt-6 rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
            评分依据：用户需求强度、证据完整度、证据可回溯性和与你的 Agent 画像匹配度。
          </div>
        </aside>

        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-zinc-950">值得调查的机会</h2>
              <p className="mt-1 text-sm text-zinc-500">来自已生成的 App 洞察，先看证据，再形成研究假设。</p>
            </div>
            <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-500">{candidates.length} 个候选</span>
          </div>

          {visibleCandidates.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-14 text-center shadow-sm">
              <CircleHelp className="mx-auto h-8 w-8 text-zinc-300" />
              <h3 className="mt-4 text-base font-semibold text-zinc-950">还没有可评分的机会</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500">先回到首页生成一个 App 的评论洞察，Agent 就能从其中提取第一批机会。</p>
              <Link href="/" className="mt-5 inline-flex items-center gap-2 rounded-md bg-zinc-950 px-4 py-2 text-sm text-white transition hover:bg-zinc-800">去生成洞察 <ArrowUpRight className="h-4 w-4" /></Link>
            </div>
          ) : (
            <>
              <div className="grid gap-4 xl:grid-cols-2">
                {visibleCandidates.map((candidate) => (
                  <article key={candidate.id} className={`rounded-xl border bg-white p-5 shadow-sm transition ${selectedId === candidate.id ? 'border-teal-400 ring-2 ring-teal-100' : 'border-zinc-200 hover:border-zinc-300'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                          <span className="rounded-full bg-zinc-100 px-2 py-1">{candidate.category}</span>
                          <span>{candidate.signal}</span>
                        </div>
                        <h3 className="mt-3 text-base font-semibold leading-6 text-zinc-950">{candidate.title}</h3>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${scoreColor(candidate.score)}`}>{candidate.score} 分</span>
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${confidenceColor(candidate.confidence)}`}>置信度 {candidate.confidence}%</span>
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-zinc-600">{candidate.summary}</p>
                    <blockquote className={`mt-4 border-l-2 pl-3 text-xs leading-5 ${candidate.evidenceStatus === 'supported' ? 'border-teal-300 text-zinc-500' : 'border-amber-300 text-amber-700'}`}>“{candidate.evidence}”</blockquote>
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                      <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-1 text-zinc-500">单 App {candidate.evidenceCount || candidate.evidenceReviews.length} 条证据</span>
                      <span className={`rounded-full border px-2 py-1 ${candidate.crossAppAppCount > 0 ? 'border-sky-200 bg-sky-50 text-sky-700' : 'border-zinc-200 bg-zinc-50 text-zinc-500'}`}>
                        <Globe2 className="mr-1 inline h-3 w-3" />跨 App {candidate.crossAppAppCount} 个
                      </span>
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3 border-t border-zinc-100 pt-4">
                      <a href={candidate.sourceApp.pagePath} className="truncate text-xs text-zinc-500 hover:text-teal-700">证据来自：{candidate.sourceApp.name}</a>
                      <button type="button" onClick={() => setSelectedId(selectedId === candidate.id ? null : candidate.id)} className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-zinc-950 px-3 py-2 text-xs font-medium text-white transition hover:bg-zinc-800">
                        <FileSearch className="h-3.5 w-3.5" />
                        {selectedId === candidate.id ? '收起研究' : '查看研究 Brief'}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
              {candidates.length > 6 ? <button type="button" onClick={() => setShowAll(!showAll)} className="mt-4 w-full rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-950">{showAll ? '收起候选' : `查看全部 ${candidates.length} 个候选`}</button> : null}
            </>
          )}
        </div>
      </div>

      {selected && brief ? (
        <div className="mt-5 rounded-xl border border-teal-200 bg-teal-50/60 p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-700">机会研究 Brief</p>
              <h2 className="mt-2 text-xl font-semibold text-zinc-950">{selected.title}</h2>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-white px-3 py-1 text-xs text-teal-700"><ShieldCheck className="h-3.5 w-3.5" />等待研究确认</span>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-white bg-white p-4"><p className="text-xs font-semibold text-zinc-400">目标用户</p><p className="mt-2 text-sm leading-6 text-zinc-700">{brief.audience}</p></div>
            <div className="rounded-lg border border-white bg-white p-4"><p className="text-xs font-semibold text-zinc-400">切入方式</p><p className="mt-2 text-sm leading-6 text-zinc-700">{brief.wedge}</p></div>
          </div>
            <div className="mt-4 rounded-lg border border-white bg-white p-4"><p className="text-xs font-semibold text-zinc-400">下一步研究动作</p><ul className="mt-2 grid gap-2 text-sm text-zinc-700 sm:grid-cols-3">{brief.features.map((item) => <li key={item} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />{item}</li>)}</ul></div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-white bg-white p-4">
              <div className="flex items-center gap-2"><Globe2 className="h-4 w-4 text-sky-700" /><p className="text-xs font-semibold text-zinc-400">跨 App 证据</p></div>
              {selected.relatedApps.length > 0 ? (
                <ul className="mt-3 space-y-2 text-sm text-zinc-700">
                  {selected.relatedApps.map((app) => <li key={app.id} className="flex items-start justify-between gap-3"><span><span className="font-medium">{app.name}</span><span className="ml-2 text-xs text-zinc-400">{app.country.toUpperCase()} · {app.evidenceCount} 条</span><span className="mt-1 block text-xs text-zinc-500">{app.title}</span></span><a href={app.pagePath} className="shrink-0 text-xs text-teal-700 hover:text-teal-900">查看</a></li>)}
                </ul>
              ) : <p className="mt-3 text-sm leading-6 text-zinc-500">当前没有匹配到其他 App 的相似信号，暂时不要把它视为普遍市场需求。</p>}
            </div>
            <div className="rounded-lg border border-amber-100 bg-amber-50/70 p-4">
              <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-700" /><p className="text-xs font-semibold text-amber-800">证据缺口</p></div>
              <ul className="mt-3 space-y-2 text-sm leading-5 text-amber-900">{selected.evidenceGaps.map((gap) => <li key={gap} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />{gap}</li>)}</ul>
            </div>
          </div>
          <div className="mt-4 rounded-lg border border-white bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-zinc-400">证据回溯 · {selected.evidenceReviews.length} 条可展开评论</p>
              <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${confidenceColor(selected.confidence)}`}>置信度 {selected.confidence}%</span>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {selected.evidenceReviews.length > 0 ? selected.evidenceReviews.map((review) => (
                <article key={review.id} className="rounded-lg border border-zinc-100 bg-zinc-50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-xs font-semibold text-zinc-800">{review.title || '用户评论'}</p>
                    <span className="shrink-0 text-[11px] text-zinc-400">{review.rating} 星</span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-zinc-600">{review.content}</p>
                  <p className="mt-2 text-[11px] text-zinc-400">{review.authorName || '匿名用户'} · {review.version || '版本未知'} · {review.updated || '时间未知'}</p>
                </article>
              )) : <p className="text-xs leading-5 text-zinc-500">当前只能看到摘要证据，暂时无法回溯到原始评论；这会降低置信度，建议先补采评论。</p>}
            </div>
            <ul className="mt-4 space-y-1 text-xs leading-5 text-zinc-500">
              {selected.confidenceReasons.map((reason) => <li key={reason} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-600" />{reason}</li>)}
            </ul>
          </div>
          <div className="mt-4 flex flex-col gap-3 rounded-lg border border-white bg-white p-4 sm:flex-row sm:items-start"><CircleHelp className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" /><p className="text-sm leading-6 text-zinc-700"><span className="font-semibold">验证问题：</span>{brief.validation}</p></div>
          <details className="mt-4 rounded-lg border border-teal-100 bg-white p-4"><summary className="cursor-pointer text-sm font-semibold text-zinc-800">查看给研究 Agent 的下一步任务</summary><pre className="mt-3 whitespace-pre-wrap text-xs leading-6 text-zinc-600">{brief.prompt}</pre></details>
        </div>
      ) : null}
    </section>
  );
}

import { ArrowUpRight, MessageCircle, Radio, Sparkles, Trophy } from 'lucide-react';
import { ProductSignal } from '@/lib/signals/types';

function kindLabel(kind: ProductSignal['kind']) {
  if (kind === 'show') return 'Show HN · 新产品';
  if (kind === 'ask') return 'Ask HN · 用户问题';
  return 'Hacker News · 热门讨论';
}

function formatDate(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric' }).format(date);
}

export default function ProductSignals({ signals }: { signals: ProductSignal[] }) {
  if (signals.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
      <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-teal-700">
              <Radio className="h-4 w-4" />
              今日产品信号
            </div>
            <h2 className="mt-2 text-xl font-semibold text-zinc-950">从讨论和新产品里发现机会</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">
              Hacker News 作为开发者和创业者的外部信号源，先展示讨论热度，再交给 Agent 做需求和产品机会判断。
            </p>
          </div>
          <a href="https://news.ycombinator.com/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-zinc-500 transition hover:text-zinc-950">
            Hacker News <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </div>

        <div className="mt-4 grid min-w-0 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {signals.slice(0, 9).map((signal) => (
            <a key={signal.id} href={signal.url} target="_blank" rel="noreferrer" className="group min-w-0 rounded-lg border border-zinc-100 bg-zinc-50 p-4 transition hover:-translate-y-0.5 hover:border-teal-200 hover:bg-teal-50/30">
              <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-500">
                <span className="inline-flex items-center gap-1 text-teal-700"><Sparkles className="h-3.5 w-3.5" />{kindLabel(signal.kind)}</span>
                <span>{formatDate(signal.publishedAt)}</span>
              </div>
              <h3 className="mt-3 line-clamp-2 text-sm font-semibold leading-6 text-zinc-950 group-hover:text-teal-800">{signal.title}</h3>
              {signal.excerpt ? <p className="mt-2 line-clamp-2 text-xs leading-5 text-zinc-500">{signal.excerpt}</p> : null}
              <div className="mt-4 flex items-center gap-3 text-xs text-zinc-500">
                <span className="inline-flex items-center gap-1"><Trophy className="h-3.5 w-3.5 text-amber-600" />{signal.score || 0}</span>
                <span className="inline-flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" />{signal.comments || 0}</span>
                {signal.author ? <span className="truncate">by {signal.author}</span> : null}
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

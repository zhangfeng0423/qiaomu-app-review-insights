import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Lightbulb } from 'lucide-react';
import { SiteFooter } from '@/components/app-review/site-footer';
import OpportunityWorkbench from '@/components/opportunities/opportunity-workbench';
import { defaultAgentProfile, getOpportunityCandidates } from '@/lib/opportunities';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '产品机会工作台',
  description: '让个人 Agent 从 App Store 用户证据中发现、评分并制造下一个小产品。',
};

export default async function OpportunitiesPage() {
  const candidates = await getOpportunityCandidates();

  return (
    <main className="min-h-screen bg-[#f7f7f4] text-zinc-950">
      <header className="border-b border-zinc-200 bg-white/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-zinc-600 transition hover:text-zinc-950">
            <ArrowLeft className="h-4 w-4" />
            返回 App 洞察
          </Link>
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-teal-700">
            <Lightbulb className="h-4 w-4" />
            Agent 产品工厂
          </div>
        </div>
      </header>

      <section className="border-b border-zinc-200 bg-[#fdfdfb]">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal-700">从证据到产品</p>
          <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-zinc-950 sm:text-5xl">
            让 Agent 找到值得制造的下一个 App
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-600">
            先从真实用户评论里发现缺口，再用产品假设和 MVP 方案把机会变成可以验证的东西。当前评分是启发式建议，保留人工确认环节。
          </p>
        </div>
      </section>

      <OpportunityWorkbench candidates={candidates} profile={defaultAgentProfile} />
      <SiteFooter />
    </main>
  );
}


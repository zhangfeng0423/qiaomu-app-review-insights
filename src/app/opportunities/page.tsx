import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import OpportunityWorkbench from '@/components/opportunities/opportunity-workbench';
import { defaultAgentProfile, getOpportunityCandidates } from '@/lib/opportunities';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '产品机会工作台',
  description: '从 App Store 用户评论证据中发现产品机会。',
};

export default async function OpportunitiesPage() {
  const candidates = await getOpportunityCandidates();

  return (
    <main className="min-h-screen bg-[#f7f7f4] text-zinc-950">
      <header className="border-b border-zinc-200 bg-white/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-zinc-600 transition hover:text-zinc-950">
            <ArrowLeft className="h-4 w-4" />
            返回首页
          </Link>
          <span className="text-sm font-semibold text-zinc-950">产品机会工作台</span>
        </div>
      </header>

      <OpportunityWorkbench candidates={candidates} profile={defaultAgentProfile} />
    </main>
  );
}


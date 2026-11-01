'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { requestResearch } from '@/lib/research-request';

interface RegenerateButtonProps {
  appId: string;
  country: string;
}

export function RegenerateButton({ appId, country }: RegenerateButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const regenerate = async () => {
    setLoading(true);
    setError('');

    try {
      const result = await requestResearch<{pageUrl:string}>('/api/research/regenerate', {
        appId, country, maxReviews:400, analyze:true, incremental:true,
      });
      router.push(`${result.pageUrl}?updated=${Date.now()}`);
      router.refresh();
    } catch (regenerateError) {
      setError(regenerateError instanceof Error ? regenerateError.message : '更新失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={regenerate}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          更新洞察
        </button>
      </div>
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}

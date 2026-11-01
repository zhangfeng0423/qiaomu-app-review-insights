import { afterEach, describe, expect, it, vi } from 'vitest';
import { PENDING_RESEARCH_KEY, requestResearch, resumeResearchJob } from '@/lib/research-request';

const id = '00000000-0000-4000-8000-000000000001';
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('persistent job browser transport', () => {
  it('registers once and restores polling after a refresh without another generation POST', async () => {
    const state = new Map<string,string>();
    vi.stubGlobal('localStorage', {
      getItem:(key:string)=>state.get(key),setItem:(key:string,value:string)=>state.set(key,value),
      removeItem:(key:string)=>state.delete(key),
    });
    const fetcher = vi.fn()
      .mockResolvedValueOnce(Response.json({success:true,data:{jobId:id}},{status:202}))
      .mockRejectedValueOnce(new Error('network interrupted'));
    vi.stubGlobal('fetch',fetcher);
    await expect(requestResearch('/api/research',{query:'123'})).rejects.toThrow('network interrupted');
    expect(state.get(PENDING_RESEARCH_KEY)).toBe(id);
    fetcher.mockResolvedValueOnce(Response.json({success:true,data:{status:'completed',result:{pageUrl:'/apps/us/123/test'}}}));
    await expect(resumeResearchJob(id)).resolves.toEqual({pageUrl:'/apps/us/123/test'});
    expect(fetcher.mock.calls.filter(call => call[1]?.method === 'POST')).toHaveLength(1);
    expect(state.has(PENDING_RESEARCH_KEY)).toBe(false);
  });

  it('reports interrupted work without silently starting another paid request', async () => {
    const removeItem = vi.fn();
    vi.stubGlobal('localStorage',{getItem:()=>id,removeItem});
    const fetcher = vi.fn().mockResolvedValue(Response.json({success:true,data:{status:'interrupted',error:'请确认后重试'}}));
    vi.stubGlobal('fetch',fetcher);
    await expect(resumeResearchJob(id)).rejects.toThrow('请确认后重试');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][1]).not.toHaveProperty('method','POST');
    expect(removeItem).toHaveBeenCalledWith(PENDING_RESEARCH_KEY);
  });
});

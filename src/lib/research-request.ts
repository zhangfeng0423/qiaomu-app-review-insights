'use client';

export const PENDING_RESEARCH_KEY = 'qiaomu:pending-research-job';
type Envelope<T> = {success:boolean;data?:T;error?:string};
function clearPending(id: string) {
  try {
    if (localStorage.getItem(PENDING_RESEARCH_KEY) === id) localStorage.removeItem(PENDING_RESEARCH_KEY);
  } catch { /* Storage may be disabled; polling still works in this tab. */ }
}

export async function resumeResearchJob<T>(id: string, signal?: AbortSignal): Promise<T> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('任务标识无效，请重新搜索');
  const deadline = Date.now()+7*60*1000;
  while (Date.now()<deadline) {
    signal?.throwIfAborted();
    const response = await fetch(`/api/research/jobs/${id}`,{cache:'no-store',signal});
    const payload = await response.json() as Envelope<{status:string;result?:T;error?:string}>;
    if (!response.ok || !payload.success || !payload.data) {
      if (response.status === 404) clearPending(id);
      throw new Error(payload.error || '暂时无法读取进度，刷新页面可恢复');
    }
    if (payload.data.status === 'completed') {
      clearPending(id);
      if (!payload.data.result) throw new Error('报告暂时不可用，请重新打开报告页');
      return payload.data.result;
    }
    if (['failed','interrupted'].includes(payload.data.status)) {
      clearPending(id);
      throw new Error(payload.data.error || '生成未完成，请确认后重试');
    }
    await new Promise<void>((resolve) => setTimeout(resolve,2000));
  }
  throw new Error('生成仍未完成，刷新页面可以恢复进度');
}

export async function requestResearch<T>(endpoint: string, body: unknown): Promise<T> {
  const response = await fetch(endpoint,{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),
  });
  const payload = await response.json() as Envelope<T & {jobId?:string}>;
  if (!response.ok || !payload.success || !payload.data) throw new Error(payload.error || '请求未完成，请稍后重试');
  if (response.status === 202 && payload.data.jobId) {
    const id = payload.data.jobId;
    try { localStorage.setItem(PENDING_RESEARCH_KEY,id); } catch { /* Optional persistence. */ }
    return resumeResearchJob<T>(id);
  }
  return payload.data;
}

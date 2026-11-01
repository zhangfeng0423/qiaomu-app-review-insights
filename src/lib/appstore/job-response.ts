import 'server-only';
import { after, NextRequest, NextResponse } from 'next/server';
import { executeDurableJob, reserveDurableJob, type JobInput } from './durable-jobs';

export async function durableJobResponse(request: NextRequest, input: JobInput) {
  const admission = await reserveDurableJob(request,input);
  if (admission.status === 'limited' || admission.status === 'cooldown') {
    const retry = admission.retryAfterSeconds || Math.max(1,Math.ceil((new Date(admission.resetAt!).getTime()-Date.now())/1000));
    return NextResponse.json({success:false,error:admission.status === 'limited'
      ? '今日生成额度已用完。已有报告可继续查看，请在额度重置后再试。'
      : `这个 App 最近已生成或尝试过，请 ${retry} 秒后再试。`,
    retryAfterSeconds:retry}, {status:429,headers:{'Retry-After':String(retry)}});
  }
  const jobId = admission.jobId!;
  after(() => executeDurableJob(jobId));
  return NextResponse.json({success:true,data:{jobId,statusUrl:`/api/research/jobs/${jobId}`}},
    {status:202,headers:{'Cache-Control':'no-store'}});
}

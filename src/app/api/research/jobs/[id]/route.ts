import { after, NextRequest, NextResponse } from 'next/server';
import { executeDurableJob, readDurableJob } from '@/lib/appstore/durable-jobs';
import { shouldUseSupabaseGenerationGuard } from '@/lib/server/supabase';
import { readCachedReviewPage } from '@/lib/appstore/cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(_request: NextRequest, context: {params: Promise<{id:string}>}) {
  const {id} = await context.params;
  const headers = {'Cache-Control':'no-store'};
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    || !shouldUseSupabaseGenerationGuard()) {
    return NextResponse.json({success:false,error:'任务不存在'},{status:404,headers});
  }
  try {
    const job = await readDurableJob(id);
    if (!job) return NextResponse.json({success:false,error:'任务不存在'},{status:404,headers});
    // Queued jobs survive a crash before after() runs. The claim RPC guarantees
    // only one executor. A running/interrupted job is never silently replayed.
    if (job.status === 'queued') after(() => executeDurableJob(id));
    let result;
    if (job.pagePath) {
      const segments = job.pagePath.split('/');
      const page = await readCachedReviewPage(segments[2],segments[3]);
      if (page) {
        // Return public evidence only; omit the full analysis corpus.
        result = {...page,allReviews:undefined,pageUrl:page.pagePath,cached:false};
      }
    }
    return NextResponse.json({success:true,data:{...job,result}},{headers});
  } catch {
    return NextResponse.json({success:false,error:'暂时无法读取进度，请稍后重试'},{status:503,headers});
  }
}

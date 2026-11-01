import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only',()=>({}));
vi.mock('@/lib/appstore/review-history',()=>({upsertReviewHistory:vi.fn()}));
import { generateCachedReviewPage, readCachedReviewPage } from '@/lib/appstore/cache';
import { AppStoreFetcher } from '@/lib/appstore/fetcher';
import { KimiClient } from '@/lib/analysis/kimi-client';
import type { AppResolution } from '@/lib/appstore/discovery';
import type { AppStoreReview } from '@/types';

const resolution: AppResolution = {source:'id', candidates:[],app:{
  id:'99999999888',country:'us',name:'Delivery fixture',artistName:'Fixture',artworkUrl:'',trackViewUrl:'',userRatingCount:0,
}};
const review: AppStoreReview = {
  id:'fixture-review',appId:resolution.app.id,country:'us',sourceCountry:'us',source:'apple-rss',
  updated:'2026-10-31T00:00:00Z',rating:'1',version:'1.0',title:'Cannot sign in',
  content:'The app crashes every time I try to sign in. Please fix this.',contentType:'text',
  authorName:'Fixture',authorUri:'',voteCount:'0',voteSum:'0',link:'',contentTypeLabel:'',
};
describe('generation failure preserves usable evidence',()=>{
  let root='';
  beforeEach(async()=>{
    root=await mkdtemp(path.join(tmpdir(),'qiaomu-failure-'));
    vi.stubEnv('APP_REVIEW_CACHE_DIR',root);
    vi.stubEnv('APP_REVIEW_CACHE_BACKEND','local');
    vi.stubEnv('QIAOMU_LLM_API_KEY',''); vi.stubEnv('DEEPSEEK_API_KEY',''); vi.stubEnv('MOONSHOT_API_KEY','');
    vi.spyOn(console,'error').mockImplementation(()=>{});
    vi.spyOn(AppStoreFetcher,'fetchReviews').mockResolvedValue([review]);
  });
  afterEach(async()=>{vi.restoreAllMocks();vi.unstubAllEnvs();await rm(root,{recursive:true,force:true});});
  it('saves a zero-review page without invoking the model',async()=>{
    vi.mocked(AppStoreFetcher.fetchReviews).mockResolvedValue([]);
    const mine=vi.spyOn(KimiClient.prototype,'mineReviewCorpus');
    const {page}=await generateCachedReviewPage({resolution,analyze:true});
    expect(page.stats.totalReviews).toBe(0); expect(page.insights).toBeNull(); expect(mine).not.toHaveBeenCalled();
  });
  it('retains low-sample evidence when model credentials are missing',async()=>{
    const {page}=await generateCachedReviewPage({resolution,analyze:true});
    expect(page.aiError).toBe('AI 服务密钥未配置或不可用');
    expect((await readCachedReviewPage('us',resolution.app.id))?.reviews[0].id).toBe(review.id);
  });
  it('retains evidence and retry information after an AI timeout',async()=>{
    vi.stubEnv('QIAOMU_LLM_API_KEY','fixture-not-a-real-key');
    vi.spyOn(KimiClient.prototype,'mineReviewCorpus').mockRejectedValue(new Error('模型请求超时'));
    const {page}=await generateCachedReviewPage({resolution,analyze:true});
    expect(page.aiError).toBe('模型请求超时'); expect(page.stats.totalReviews).toBe(1);
    expect((await readCachedReviewPage('us',resolution.app.id))?.insights).toBeNull();
  });
  it('does not overwrite an existing report when Apple fetching fails',async()=>{
    const original=await generateCachedReviewPage({resolution,analyze:false});
    vi.mocked(AppStoreFetcher.fetchReviews).mockRejectedValue(new Error('Apple unavailable'));
    await expect(generateCachedReviewPage({resolution,force:true})).rejects.toThrow('Apple unavailable');
    expect((await readCachedReviewPage('us',resolution.app.id))?.updatedAt).toBe(original.page.updatedAt);
  });
});

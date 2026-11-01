import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseAppStoreUrl } from '@/lib/app-store-parser';
import { resolveAppQuery, validateResearchInput } from '@/lib/appstore/discovery';

describe('public research input', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('only accepts exact Apple hosts and IDs from the path', () => {
    expect(parseAppStoreUrl('https://apps.apple.com/us/app/chatgpt/id6448311069')?.id).toBe('6448311069');
    expect(parseAppStoreUrl('https://evil-apple.com/us/app/id6448311069')).toBeNull();
    expect(parseAppStoreUrl('https://apps.apple.com.evil.test/us/app/id6448311069')).toBeNull();
    expect(parseAppStoreUrl('https://apps.apple.com/us/app/missing?x=id6448311069')).toBeNull();
  });
  it('rejects malformed URLs, unknown regions, incomplete IDs, and blank queries before network work', async () => {
    expect(() => validateResearchInput('https://example.com/app','us')).toThrow('链接');
    expect(() => validateResearchInput('ChatGPT','zz')).toThrow('国家');
    expect(() => validateResearchInput('123','us')).toThrow('ID');
    await expect(resolveAppQuery('','us')).rejects.toThrow('请输入');
  });
  it('does not invent an App when Apple lookup or search has no matches', async () => {
    vi.stubGlobal('fetch',vi.fn(async()=>Response.json({resultCount:0,results:[]})));
    await expect(resolveAppQuery('qiaomu-no-match-fixture','us')).rejects.toThrow('没有找到');
    await expect(resolveAppQuery('https://apps.apple.com/us/app/missing/id999999999999','us')).rejects.toThrow('区找到');
  });
  it('shows an actionable Apple failure without leaking transport details', async () => {
    vi.stubGlobal('fetch',vi.fn(async()=>{throw new Error('private transport failure');}));
    await expect(resolveAppQuery('Signal','us')).rejects.toThrow('App Store 请求失败或超时');
  });
});

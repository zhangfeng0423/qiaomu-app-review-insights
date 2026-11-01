import { describe, expect, it } from 'vitest';
import { parseAppStoreUrl } from '@/lib/app-store-parser';
import { resolveAppQuery, validateResearchInput } from '@/lib/appstore/discovery';

describe('public research input', () => {
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
});

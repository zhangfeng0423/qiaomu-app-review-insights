import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  runGuardedPublicGeneration,
  runGuardedPublicRefresh,
} from '@/lib/appstore/generation-guard';

function request(ip: string) {
  return { headers: new Headers({ 'x-real-ip': ip }) } as NextRequest;
}

describe('public generation guard', () => {
  let guardDir = '';

  beforeEach(async () => {
    guardDir = await mkdtemp(path.join(tmpdir(), 'app-review-generation-'));
    process.env.APP_REVIEW_GENERATION_LIMIT_DIR = guardDir;
    process.env.APP_REVIEW_PUBLIC_DAILY_NEW_APP_LIMIT = '5';
    process.env.APP_REVIEW_PUBLIC_REFRESH_INTERVAL_MINUTES = '15';
  });

  afterEach(async () => {
    delete process.env.APP_REVIEW_GENERATION_LIMIT_DIR;
    delete process.env.APP_REVIEW_PUBLIC_DAILY_NEW_APP_LIMIT;
    delete process.env.APP_REVIEW_PUBLIC_REFRESH_INTERVAL_MINUTES;
    await rm(guardDir, { recursive: true, force: true });
  });

  it('queues a new App without invoking generation when the public limit is exhausted', async () => {
    process.env.APP_REVIEW_PUBLIC_DAILY_NEW_APP_LIMIT = '0';
    const generate = vi.fn(async () => ({ page: 'should-not-run' }));

    const result = await runGuardedPublicGeneration({
      request: request('203.0.113.10'),
      appKey: 'cn-123',
      queue: {
        appKey: 'cn-123',
        appId: '123',
        appName: 'Example',
        country: 'cn',
        query: '123',
        reason: 'rate-limited',
      },
      generate,
    });

    expect(result.status).toBe('queued');
    expect(generate).not.toHaveBeenCalled();
    const day = new Date().toISOString().slice(0, 10);
    const queued = await readFile(path.join(guardDir, 'queue', `${day}.jsonl`), 'utf8');
    expect(queued).toContain('"appKey":"cn-123"');
  });

  it('deduplicates concurrent refreshes for the same App', async () => {
    let finish!: (value: { page: string }) => void;
    const pending = new Promise<{ page: string }>((resolve) => { finish = resolve; });
    const generate = vi.fn(() => pending);
    const first = runGuardedPublicRefresh({
      request: request('203.0.113.11'),
      appKey: 'us-456',
      generate,
    });

    await vi.waitFor(() => expect(generate).toHaveBeenCalledTimes(1));

    const second = runGuardedPublicRefresh({
      request: request('203.0.113.11'),
      appKey: 'us-456',
      generate,
    });
    finish({ page: 'ready' });

    const [firstResult, secondResult] = await Promise.all([first, second]);
    expect(firstResult).toMatchObject({ status: 'generated', result: { page: 'ready' } });
    expect(secondResult).toMatchObject({ status: 'deduped', result: { page: 'ready' } });
    expect(generate).toHaveBeenCalledTimes(1);
  });
});

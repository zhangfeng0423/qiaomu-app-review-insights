import 'server-only';

import crypto from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import type { NextRequest } from 'next/server';
import type { NextResponse } from 'next/server';
import { CachedAppReviewPage } from '@/lib/appstore/cache';
import { getServerSupabase, shouldUseSupabaseGenerationGuard } from '@/lib/server/supabase';

const DEFAULT_DAILY_LIMIT = 5;
const DEFAULT_FRESH_DAYS = 3;
export const PUBLIC_GENERATION_COOKIE = 'qiaomu_generation_id';

interface DailyClientState {
  generatedAppKeys: string[];
  queuedAppKeys: string[];
  refreshedAppAt?: Record<string, string>;
  updatedAt: string;
}

interface DailyGenerationState {
  day: string;
  clients: Record<string, DailyClientState>;
}

export interface GenerationLimitInfo {
  limit: number;
  used: number;
  remaining: number;
  resetAt: string;
}

export interface GenerationReservation {
  allowed: boolean;
  clientKey: string;
  limit: GenerationLimitInfo;
}

export interface QueuedGenerationRequest {
  appKey: string;
  appId: string;
  appName?: string;
  country: string;
  query?: string;
  reason: 'rate-limited';
}

export type GuardedPublicGenerationResult<T> =
  | { status: 'generated' | 'deduped'; result: T }
  | { status: 'queued'; limit: GenerationLimitInfo };

export type GuardedPublicRefreshResult<T> =
  | { status: 'generated' | 'deduped'; result: T }
  | { status: 'rate-limited'; retryAfterSeconds: number };

const inFlightGenerations = new Map<string, Promise<unknown>>();

function dataRoot() {
  return process.env.APP_REVIEW_GENERATION_LIMIT_DIR
    || path.join(
      process.env.APP_REVIEW_CACHE_DIR || path.join(process.cwd(), 'src', 'data', 'app-cache'),
      '.generation-guard'
    );
}

function dailyLimit() {
  const parsed = Number.parseInt(process.env.APP_REVIEW_PUBLIC_DAILY_NEW_APP_LIMIT || '', 10);
  if (!Number.isFinite(parsed)) return DEFAULT_DAILY_LIMIT;
  return Math.max(0, parsed);
}

function refreshIntervalMs() {
  const parsed = Number.parseInt(process.env.APP_REVIEW_PUBLIC_REFRESH_INTERVAL_MINUTES || '', 10);
  const minutes = Number.isFinite(parsed) ? Math.max(1, parsed) : 15;
  return minutes * 60 * 1000;
}

export function publicCacheFreshDays() {
  const parsed = Number.parseInt(process.env.APP_REVIEW_PUBLIC_CACHE_FRESH_DAYS || '', 10);
  if (!Number.isFinite(parsed)) return DEFAULT_FRESH_DAYS;
  return Math.max(1, parsed);
}

function dayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function resetAtForDay(day: string) {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString();
}

function stateFilePath(day = dayKey()) {
  return path.join(dataRoot(), 'daily', `${day}.json`);
}

function queueFilePath(day = dayKey()) {
  return path.join(dataRoot(), 'queue', `${day}.jsonl`);
}

function clientIp(request: NextRequest) {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return request.headers.get('cf-connecting-ip')
    || request.headers.get('x-real-ip')
    || forwardedFor
    || (request as unknown as { ip?: string }).ip
    || 'unknown';
}

export function clientGenerationKey(request: NextRequest) {
  const cookieValue = request.cookies?.get(PUBLIC_GENERATION_COOKIE)?.value;
  return crypto
    .createHash('sha256')
    .update(`appreview-public-generation:${cookieValue || clientIp(request)}`)
    .digest('hex')
    .slice(0, 32);
}

export function setGenerationCookie<T extends NextResponse>(response: T, request: NextRequest): T {
  if (!request.cookies?.get(PUBLIC_GENERATION_COOKIE)?.value) {
    response.cookies.set({
      name: PUBLIC_GENERATION_COOKIE,
      value: crypto.randomUUID(),
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 180,
      path: '/',
    });
  }
  return response;
}

export function appGenerationKey(country: string, appId: string) {
  return `${country.toLowerCase()}-${appId.replace(/\D/g, '')}`;
}

export function isFreshCachedPage(page: CachedAppReviewPage | null, freshDays = publicCacheFreshDays()) {
  if (!page?.updatedAt) return false;
  const updatedAt = new Date(page.updatedAt).getTime();
  if (!Number.isFinite(updatedAt)) return false;
  return Date.now() - updatedAt < freshDays * 24 * 60 * 60 * 1000;
}

async function ensureDir(filePath: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function readDailyState(day = dayKey()): Promise<DailyGenerationState> {
  if (shouldUseSupabaseGenerationGuard()) {
    const { data, error } = await getServerSupabase()
      .from('app_review_generation_states')
      .select('client_key, generated_app_keys, queued_app_keys, refreshed_app_at')
      .eq('day', day);
    if (error) throw error;

    return {
      day,
      clients: Object.fromEntries((data || []).map((row) => [row.client_key, {
        generatedAppKeys: row.generated_app_keys || [],
        queuedAppKeys: row.queued_app_keys || [],
        refreshedAppAt: row.refreshed_app_at || {},
        updatedAt: new Date().toISOString(),
      }])),
    };
  }

  try {
    const content = await fs.readFile(stateFilePath(day), 'utf8');
    const parsed = JSON.parse(content) as DailyGenerationState;
    return {
      day,
      clients: parsed.clients || {},
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    return { day, clients: {} };
  }
}

async function writeDailyState(state: DailyGenerationState) {
  if (shouldUseSupabaseGenerationGuard()) {
    const rows = Object.entries(state.clients).map(([clientKey, client]) => ({
      day: state.day,
      client_key: clientKey,
      generated_app_keys: client.generatedAppKeys,
      queued_app_keys: client.queuedAppKeys,
      refreshed_app_at: client.refreshedAppAt || {},
      updated_at: client.updatedAt,
    }));
    if (rows.length === 0) return;

    const { error } = await getServerSupabase()
      .from('app_review_generation_states')
      .upsert(rows, { onConflict: 'day,client_key' });
    if (error) throw error;
    return;
  }

  const filePath = stateFilePath(state.day);
  await ensureDir(filePath);
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmpPath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  await fs.rename(tmpPath, filePath);
}

function getClientState(state: DailyGenerationState, clientKey: string) {
  state.clients[clientKey] ||= {
    generatedAppKeys: [],
    queuedAppKeys: [],
    updatedAt: new Date().toISOString(),
  };
  state.clients[clientKey].generatedAppKeys ||= [];
  state.clients[clientKey].queuedAppKeys ||= [];
  state.clients[clientKey].refreshedAppAt ||= {};
  return state.clients[clientKey];
}

function limitInfo(client: DailyClientState, limit: number, day: string): GenerationLimitInfo {
  const used = new Set(client.generatedAppKeys).size;
  return {
    limit,
    used,
    remaining: Math.max(0, limit - used),
    resetAt: resetAtForDay(day),
  };
}

export async function reservePublicGeneration(request: NextRequest, appKey: string): Promise<GenerationReservation> {
  const day = dayKey();
  const clientKey = clientGenerationKey(request);
  const state = await readDailyState(day);
  const client = getClientState(state, clientKey);
  const limit = dailyLimit();
  const generated = new Set(client.generatedAppKeys);

  if (!generated.has(appKey) && generated.size >= limit) {
    return {
      allowed: false,
      clientKey,
      limit: limitInfo(client, limit, day),
    };
  }

  if (!generated.has(appKey)) {
    client.generatedAppKeys.push(appKey);
  }

  client.updatedAt = new Date().toISOString();
  await writeDailyState(state);

  return {
    allowed: true,
    clientKey,
    limit: limitInfo(client, limit, day),
  };
}

export async function queuePublicGeneration(
  request: NextRequest,
  requestInfo: QueuedGenerationRequest
): Promise<GenerationLimitInfo> {
  const day = dayKey();
  const clientKey = clientGenerationKey(request);
  const state = await readDailyState(day);
  const client = getClientState(state, clientKey);

  if (!client.queuedAppKeys.includes(requestInfo.appKey)) {
    client.queuedAppKeys.push(requestInfo.appKey);
  }

  client.updatedAt = new Date().toISOString();
  await writeDailyState(state);

  const queuePath = queueFilePath(day);
  if (shouldUseSupabaseGenerationGuard()) {
    const { error } = await getServerSupabase()
      .from('app_review_generation_queue')
      .upsert({
        day,
        client_key: clientKey,
        app_key: requestInfo.appKey,
        app_id: requestInfo.appId,
        app_name: requestInfo.appName || null,
        country: requestInfo.country,
        query: requestInfo.query || null,
        reason: requestInfo.reason,
      }, { onConflict: 'day,client_key,app_key' });
    if (error) throw error;
    return limitInfo(client, dailyLimit(), day);
  }

  await ensureDir(queuePath);
  await fs.appendFile(queuePath, `${JSON.stringify({
    ...requestInfo,
    clientKey,
    queuedAt: new Date().toISOString(),
  })}\n`, 'utf8');

  return limitInfo(client, dailyLimit(), day);
}

export async function reservePublicRefresh(request: NextRequest, appKey: string) {
  const day = dayKey();
  const clientKey = clientGenerationKey(request);
  const state = await readDailyState(day);
  const client = getClientState(state, clientKey);
  const lastRefreshedAt = client.refreshedAppAt?.[appKey];
  const lastTime = lastRefreshedAt ? new Date(lastRefreshedAt).getTime() : 0;
  const elapsed = Date.now() - lastTime;
  const interval = refreshIntervalMs();

  if (lastTime && elapsed < interval) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((interval - elapsed) / 1000),
    };
  }

  client.refreshedAppAt![appKey] = new Date().toISOString();
  client.updatedAt = new Date().toISOString();
  await writeDailyState(state);

  return { allowed: true, retryAfterSeconds: 0 };
}

export function hasInFlightGeneration(appKey: string) {
  return inFlightGenerations.has(appKey);
}

export async function runDedupedGeneration<T>(appKey: string, generate: () => Promise<T>) {
  const existing = inFlightGenerations.get(appKey) as Promise<T> | undefined;
  if (existing) {
    return {
      deduped: true,
      result: await existing,
    };
  }

  const promise = generate().finally(() => {
    inFlightGenerations.delete(appKey);
  });

  inFlightGenerations.set(appKey, promise);

  return {
    deduped: false,
    result: await promise,
  };
}

export async function runGuardedPublicGeneration<T>(options: {
  request: NextRequest;
  appKey: string;
  queue: QueuedGenerationRequest;
  generate: () => Promise<T>;
}): Promise<GuardedPublicGenerationResult<T>> {
  const alreadyInFlight = hasInFlightGeneration(options.appKey);

  if (!alreadyInFlight) {
    const reservation = await reservePublicGeneration(options.request, options.appKey);
    if (!reservation.allowed) {
      const limit = await queuePublicGeneration(options.request, options.queue);
      return { status: 'queued', limit };
    }
  }

  const generation = await runDedupedGeneration(options.appKey, options.generate);
  return {
    status: generation.deduped ? 'deduped' : 'generated',
    result: generation.result,
  };
}

export async function runGuardedPublicRefresh<T>(options: {
  request: NextRequest;
  appKey: string;
  generate: () => Promise<T>;
}): Promise<GuardedPublicRefreshResult<T>> {
  const alreadyInFlight = hasInFlightGeneration(options.appKey);

  if (!alreadyInFlight) {
    const reservation = await reservePublicRefresh(options.request, options.appKey);
    if (!reservation.allowed) {
      return {
        status: 'rate-limited',
        retryAfterSeconds: reservation.retryAfterSeconds,
      };
    }
  }

  const generation = await runDedupedGeneration(options.appKey, options.generate);
  return {
    status: generation.deduped ? 'deduped' : 'generated',
    result: generation.result,
  };
}

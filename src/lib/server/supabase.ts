import 'server-only';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export function hasSupabaseServerConfig() {
  return Boolean(process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY));
}

export function shouldUseSupabasePersistence() {
  return process.env.APP_REVIEW_CACHE_BACKEND === 'supabase';
}

export function shouldUseSupabaseGenerationGuard() {
  return process.env.APP_REVIEW_GENERATION_BACKEND === 'supabase' || process.env.APP_REVIEW_CACHE_BACKEND === 'supabase';
}

export function getServerSupabase(): SupabaseClient {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('已选择 Supabase 持久化，但缺少 SUPABASE_URL 与 SUPABASE_SERVICE_ROLE_KEY（或 SUPABASE_ANON_KEY）');
  }

  client = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return client;
}

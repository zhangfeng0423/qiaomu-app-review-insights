-- Repeatable public-trial persistence migration. No business rows are removed.
CREATE TABLE IF NOT EXISTS public.app_review_pages (
  cache_key text PRIMARY KEY, country text NOT NULL, app_id text NOT NULL,
  payload jsonb NOT NULL, generated_at timestamptz, updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_app_review_pages_updated ON public.app_review_pages(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_review_pages_app ON public.app_review_pages(app_id, country);
CREATE TABLE IF NOT EXISTS public.app_review_generation_states (
  day date NOT NULL, client_key text NOT NULL,
  generated_app_keys text[] NOT NULL DEFAULT '{}', queued_app_keys text[] NOT NULL DEFAULT '{}',
  refreshed_app_at jsonb NOT NULL DEFAULT '{}', updated_at timestamptz DEFAULT now(),
  PRIMARY KEY(day, client_key)
);
CREATE TABLE IF NOT EXISTS public.app_review_generation_queue (
  day date NOT NULL, client_key text NOT NULL, app_key text NOT NULL,
  app_id text NOT NULL, app_name text, country text NOT NULL, query text, reason text NOT NULL,
  created_at timestamptz DEFAULT now(), PRIMARY KEY(day, client_key, app_key)
);
CREATE INDEX IF NOT EXISTS idx_app_review_generation_queue_created ON public.app_review_generation_queue(created_at DESC);
CREATE TABLE IF NOT EXISTS public.app_review_history (
  cache_key text PRIMARY KEY, payload jsonb NOT NULL, updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.app_review_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_review_generation_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_review_generation_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_review_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_review_pages, public.app_review_generation_states,
  public.app_review_generation_queue, public.app_review_history FROM anon, authenticated;
GRANT ALL ON public.app_review_pages, public.app_review_generation_states,
  public.app_review_generation_queue, public.app_review_history TO service_role;
NOTIFY pgrst, 'reload schema';

-- Transactional admission and fenced execution. Only service_role can invoke.
CREATE TABLE IF NOT EXISTS public.app_review_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_key text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('reviews','analysis')),
  ip_key text NOT NULL,
  input jsonb NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','completed','failed','interrupted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  lease_until timestamptz NOT NULL DEFAULT (now() + interval '6 minutes'),
  worker_token uuid,
  page_path text,
  error text
);
CREATE INDEX IF NOT EXISTS app_review_jobs_quota ON public.app_review_jobs(ip_key,created_at);
CREATE INDEX IF NOT EXISTS app_review_jobs_app ON public.app_review_jobs(app_key,created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS app_review_jobs_active ON public.app_review_jobs(app_key)
  WHERE status IN ('queued','running');
ALTER TABLE public.app_review_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_review_jobs FROM anon, authenticated;
GRANT ALL ON public.app_review_jobs TO service_role;

CREATE OR REPLACE FUNCTION public.reserve_review_job(
  p_app_key text, p_kind text, p_ip_key text, p_input jsonb,
  p_daily_limit integer DEFAULT 5, p_cooldown_seconds integer DEFAULT 900
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE j public.app_review_jobs; used integer; reset_at timestamptz;
BEGIN
  IF p_kind NOT IN ('reviews','analysis') OR p_app_key !~ '^[a-z]{2}-[0-9]+$'
    OR length(p_ip_key) < 16 THEN RAISE EXCEPTION 'Invalid admission parameters'; END IF;
  -- Fixed lock order avoids deadlocks between quota and app reservations.
  PERFORM pg_advisory_xact_lock(hashtextextended('quota:' || p_ip_key, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('app:' || p_app_key, 0));
  UPDATE public.app_review_jobs SET status='interrupted', finished_at=now(),
    error='生成被中断，已有报告保持可用。请确认后重试；重试可能重新调用 AI。'
    WHERE app_key=p_app_key AND status IN ('queued','running') AND lease_until < now();
  SELECT * INTO j FROM public.app_review_jobs
    WHERE app_key=p_app_key AND status IN ('queued','running') LIMIT 1;
  IF FOUND THEN RETURN jsonb_build_object('status','existing','jobId',j.id); END IF;
  SELECT * INTO j FROM public.app_review_jobs WHERE app_key=p_app_key AND kind=p_kind
    ORDER BY created_at DESC LIMIT 1;
  IF FOUND AND COALESCE(j.finished_at,j.created_at) > now() - make_interval(secs =>
      CASE WHEN j.status='completed' THEN greatest(30,p_cooldown_seconds) ELSE 30 END) THEN
    RETURN jsonb_build_object('status','cooldown','jobId',j.id,'retryAfterSeconds',
      greatest(1,ceil(extract(epoch FROM (COALESCE(j.finished_at,j.created_at) + make_interval(secs =>
        CASE WHEN j.status='completed' THEN greatest(30,p_cooldown_seconds) ELSE 30 END) - now())))));
  END IF;
  reset_at := (date_trunc('day',now() AT TIME ZONE 'UTC') + interval '1 day') AT TIME ZONE 'UTC';
  SELECT count(*) INTO used FROM public.app_review_jobs
    WHERE ip_key=p_ip_key AND created_at >= reset_at - interval '1 day';
  IF used >= greatest(0,p_daily_limit) THEN
    RETURN jsonb_build_object('status','limited','used',used,'limit',p_daily_limit,'resetAt',reset_at);
  END IF;
  INSERT INTO public.app_review_jobs(app_key,kind,ip_key,input)
    VALUES(p_app_key,p_kind,p_ip_key,p_input) RETURNING * INTO j;
  RETURN jsonb_build_object('status','created','jobId',j.id,'remaining',greatest(0,p_daily_limit-used-1));
END $$;

CREATE OR REPLACE FUNCTION public.claim_review_job(p_id uuid, p_token uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE j public.app_review_jobs;
BEGIN
  UPDATE public.app_review_jobs SET status='running', started_at=now(), worker_token=p_token,
    lease_until=now()+interval '6 minutes'
    WHERE id=p_id AND status='queued' AND lease_until >= now() RETURNING * INTO j;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN to_jsonb(j);
END $$;

CREATE OR REPLACE FUNCTION public.read_review_job(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE j public.app_review_jobs;
BEGIN
  UPDATE public.app_review_jobs SET status='interrupted',finished_at=now(),
    error='生成超时或被中断。已有报告保持可用，请确认后重试；重试可能重新调用 AI。'
    WHERE id=p_id AND status IN ('queued','running') AND lease_until < now();
  SELECT * INTO j FROM public.app_review_jobs WHERE id=p_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('id',j.id,'status',j.status,'pagePath',j.page_path,
    'error',j.error,'createdAt',j.created_at,'finishedAt',j.finished_at);
END $$;

REVOKE ALL ON FUNCTION public.reserve_review_job(text,text,text,jsonb,integer,integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.claim_review_job(uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.read_review_job(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_review_job(text,text,text,jsonb,integer,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_review_job(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.read_review_job(uuid) TO service_role;
NOTIFY pgrst, 'reload schema';

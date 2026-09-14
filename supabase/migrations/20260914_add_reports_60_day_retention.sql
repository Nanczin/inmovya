-- Retain only the last 60 days of report-only activity data.
-- Business records such as leads, campaigns, reminders and properties are not touched.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

CREATE OR REPLACE FUNCTION public.purge_report_data_older_than_60_days()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  cutoff_timestamp timestamptz := now() - interval '60 days';
  cutoff_date date := current_date - 60;
BEGIN
  DELETE FROM public.ligacoes
  WHERE data_ligacao < cutoff_timestamp;

  DELETE FROM public.email_logs
  WHERE sent_at < cutoff_timestamp;

  DELETE FROM public.powerbi_funnel_metrics
  WHERE CASE
    WHEN period ~ '^dia:[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      THEN to_date(substr(period, 5), 'YYYY-MM-DD') < cutoff_date
    ELSE COALESCE(updated_at, created_at) < cutoff_timestamp
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_report_data_older_than_60_days() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.purge_report_data_older_than_60_days() FROM anon;
REVOKE ALL ON FUNCTION public.purge_report_data_older_than_60_days() FROM authenticated;

DO $$
DECLARE
  existing_job_id bigint;
BEGIN
  SELECT jobid
  INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'purge-report-data-after-60-days'
  LIMIT 1;

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;

  PERFORM cron.schedule(
    'purge-report-data-after-60-days',
    '15 3 * * *',
    'SELECT public.purge_report_data_older_than_60_days();'
  );
END;
$$;

-- Enforce the retention window immediately when this migration is applied.
SELECT public.purge_report_data_older_than_60_days();

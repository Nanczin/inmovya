-- Enable required extensions
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema extensions;

-- Create or replace the cron job to process the email queue every minute
select
  cron.schedule(
    'smart-email-processor-every-minute',
    '* * * * *',
    $$
    select
      net.http_post(
        url:='https://hhtzdxtythejyykrpgqw.supabase.co/functions/v1/smart-email-processor',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhodHpkeHR5dGhlanl5a3JwZ3F3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQwNjQ0NTMsImV4cCI6MjA2OTY0MDQ1M30.BSNW9wL7JBjin_AMl-u9nYV59kLD_fhojQTf3SefUsE"}'::jsonb,
        body:='{}'::jsonb
      ) as request_id;
    $$
  );
-- Aviso de lead novo: chama a função notify-new-lead sempre que entra um lead
-- da captura automática (roleta/Bitrix ou Meta Ads).
create extension if not exists pg_net;

create or replace function public.notify_new_lead()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(coalesce(new.origem, '')) = 'roleta'
     or 'roleta' = any(coalesce(new.tags, '{}'::text[]))
     or 'Meta Ads' = any(coalesce(new.tags, '{}'::text[])) then
    perform net.http_post(
      url := 'https://hhtzdxtythejyykrpgqw.supabase.co/functions/v1/notify-new-lead',
      body := jsonb_build_object('lead_id', new.id),
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_new_lead on public.leads;
create trigger trg_notify_new_lead
after insert on public.leads
for each row execute function public.notify_new_lead();

-- Tabela das inscrições de push (já usada pelo app; cria se ainda não existir)
create table if not exists public.user_push_subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  subscription jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, subscription)
);
alter table public.user_push_subscriptions enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='user_push_subscriptions' and policyname='Users can insert their own subscriptions') then
    create policy "Users can insert their own subscriptions" on public.user_push_subscriptions for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename='user_push_subscriptions' and policyname='Users can view their own subscriptions') then
    create policy "Users can view their own subscriptions" on public.user_push_subscriptions for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename='user_push_subscriptions' and policyname='Users can update their own subscriptions') then
    create policy "Users can update their own subscriptions" on public.user_push_subscriptions for update using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename='user_push_subscriptions' and policyname='Users can delete their own subscriptions') then
    create policy "Users can delete their own subscriptions" on public.user_push_subscriptions for delete using (auth.uid() = user_id);
  end if;
end $$;

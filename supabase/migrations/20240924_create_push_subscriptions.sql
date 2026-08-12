create table if not exists public.user_push_subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  subscription jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  /* Ensure unique subscriptions per user to avoid duplicates */
  unique(user_id, subscription)
);

alter table public.user_push_subscriptions enable row level security;

create policy "Users can insert their own subscriptions"
  on public.user_push_subscriptions for insert
  with check (auth.uid() = user_id);

create policy "Users can view their own subscriptions"
  on public.user_push_subscriptions for select
  using (auth.uid() = user_id);

create policy "Users can delete their own subscriptions"
  on public.user_push_subscriptions for delete
  using (auth.uid() = user_id);

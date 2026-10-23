-- ARENA SPARTANA: guarda as suas metas (do dia e do mês) para valer em qualquer computador.
-- O resto (XP, missões, conquistas) é calculado das ligações e dos registros do dia. Nada é apagado.
create table if not exists public.arena_metas (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  metas jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.arena_metas enable row level security;
drop policy if exists "arena_metas do dono" on public.arena_metas;
create policy "arena_metas do dono" on public.arena_metas
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

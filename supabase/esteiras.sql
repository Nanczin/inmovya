-- ESTEIRAS NO INMOVYA (unificação com o Inmovya Scale)
-- Clique em Run uma única vez.

create table if not exists public.esteiras (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome text not null,
  ordem int not null default 0,
  ao_concluir_tag text default 'disparo',
  scale_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.esteira_passos (
  id uuid primary key default gen_random_uuid(),
  esteira_id uuid not null references public.esteiras(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  ordem int not null default 0,
  titulo text not null default '',
  mensagem text not null default '',
  dias_espera int not null default 1,
  so_colar boolean not null default false,
  scale_id text,
  created_at timestamptz not null default now()
);

create index if not exists esteira_passos_esteira_idx on public.esteira_passos (esteira_id, ordem);

alter table public.leads add column if not exists esteira_id uuid references public.esteiras(id) on delete set null;
alter table public.leads add column if not exists esteira_passo int not null default 0;
alter table public.leads add column if not exists esteira_proximo timestamptz;
alter table public.leads add column if not exists esteira_ultimo_envio timestamptz;
create index if not exists leads_esteira_idx on public.leads (esteira_id, esteira_proximo);

alter table public.esteiras enable row level security;
alter table public.esteira_passos enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'esteiras' and policyname = 'esteiras do proprio usuario') then
    create policy "esteiras do proprio usuario" on public.esteiras
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'esteira_passos' and policyname = 'passos do proprio usuario') then
    create policy "passos do proprio usuario" on public.esteira_passos
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

notify pgrst, 'reload schema';

-- GESTOR DE MÉTRICAS — metas do mês, plano de hoje e valor das vendas no "Registrar o dia".
-- Rode no SQL Editor do Supabase → colar tudo → Run. Pode rodar de novo sem problema.

-- 1) Metas do mês (uma linha por usuário e mês)
create table if not exists public.metas_mensais (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  mes text not null check (mes ~ '^\d{4}-\d{2}$'), -- AAAA-MM
  interacoes integer not null default 0,
  negociacoes integer not null default 0,
  visitas integer not null default 0,
  documentacoes integer not null default 0,
  vendas_qtd integer not null default 0,
  vendas_valor numeric(14, 2) not null default 0,
  leads integer not null default 0,
  ligacoes integer not null default 0,
  so_dias_uteis boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, mes)
);
alter table public.metas_mensais enable row level security;
drop policy if exists "metas_mensais do dono" on public.metas_mensais;
create policy "metas_mensais do dono" on public.metas_mensais
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 2) Plano de hoje (o que você marcou como feito em cada dia)
create table if not exists public.plano_diario (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  dia date not null,
  feitos text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, dia)
);
alter table public.plano_diario enable row level security;
drop policy if exists "plano_diario do dono" on public.plano_diario;
create policy "plano_diario do dono" on public.plano_diario
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 3) Valor das vendas (R$) no registro do dia
alter table public.powerbi_funnel_metrics add column if not exists venda_valor numeric(14, 2) not null default 0;

-- updated_at automático
create or replace function public.gestor_tocar_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists metas_mensais_updated_at on public.metas_mensais;
create trigger metas_mensais_updated_at before update on public.metas_mensais for each row execute function public.gestor_tocar_updated_at();
drop trigger if exists plano_diario_updated_at on public.plano_diario;
create trigger plano_diario_updated_at before update on public.plano_diario for each row execute function public.gestor_tocar_updated_at();

notify pgrst, 'reload schema';

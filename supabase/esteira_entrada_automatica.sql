-- ENTRADA AUTOMÁTICA NAS ESTEIRAS (aba Esteiras do Inmovya → "Entrada automática")
-- Regra: "quem entrar com a etiqueta X entra na esteira Y".
-- Vale para lead novo (captura Midrah, Bitrix, Meta Ads, cadastro, importação) e para lead que GANHA a
-- etiqueta depois. Olha tags, etiqueta de projeto, origem e etapa (ex.: 20%).
-- Não mexe em quem já está numa esteira nem em quem já respondeu/fechou.
-- Rode uma vez no Supabase: SQL Editor → colar tudo → Run.

create table if not exists public.esteira_regras (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  etiqueta text not null,
  esteira_id uuid not null references public.esteiras(id) on delete cascade,
  comecar_hoje boolean not null default false,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.esteira_regras enable row level security;
drop policy if exists esteira_regras_dono on public.esteira_regras;
create policy esteira_regras_dono on public.esteira_regras
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create index if not exists esteira_regras_user_idx on public.esteira_regras (user_id, ativo);

create or replace function public.leads_esteira_automatica()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agora text[];
  v_antes text[] := '{}';
  v_regra record;
begin
  if new.esteira_id is not null then return new; end if;
  if coalesce(new.status, '') in ('Respondeu', 'Fechado', 'Perdido', 'Deny List') then return new; end if;

  v_agora := coalesce(new.tags, '{}'::text[]) || coalesce(new.etiqueta_projeto, '{}'::text[])
             || array[coalesce(new.origem, ''), coalesce(new.status, '')];
  if tg_op = 'UPDATE' then
    v_antes := coalesce(old.tags, '{}'::text[]) || coalesce(old.etiqueta_projeto, '{}'::text[])
               || array[coalesce(old.origem, ''), coalesce(old.status, '')];
  end if;

  -- a etiqueta precisa ter acabado de chegar (lead novo ou etiqueta nova)
  select r.esteira_id, r.comecar_hoje into v_regra
  from public.esteira_regras r
  join public.esteiras e on e.id = r.esteira_id
  where r.user_id = new.user_id and r.ativo
    and exists (select 1 from unnest(v_agora) x where public.projeto_norm(x) <> '' and public.projeto_norm(x) = public.projeto_norm(r.etiqueta))
    and not exists (select 1 from unnest(v_antes) x where public.projeto_norm(x) <> '' and public.projeto_norm(x) = public.projeto_norm(r.etiqueta))
  order by r.created_at
  limit 1;

  if found then
    new.esteira_id := v_regra.esteira_id;
    new.esteira_passo := 0;
    -- padrão: começa no dia seguinte (o 1º contato sai hoje); ou hoje mesmo
    new.esteira_proximo := case
      when v_regra.comecar_hoje then now()
      else (date_trunc('day', now() at time zone 'America/Sao_Paulo') + interval '1 day') at time zone 'America/Sao_Paulo'
    end;
  end if;
  return new;
end;
$$;

-- "zz_" para rodar depois do gatilho que calcula a etiqueta de projeto
drop trigger if exists zz_leads_esteira_automatica on public.leads;
create trigger zz_leads_esteira_automatica
before insert or update of tags, etiqueta_projeto, origem, status, projeto_origem, observacoes on public.leads
for each row execute function public.leads_esteira_automatica();

notify pgrst, 'reload schema';

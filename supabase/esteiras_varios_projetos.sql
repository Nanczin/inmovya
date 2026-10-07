-- VÁRIAS ESTEIRAS NA MESMA COLUNA (ex.: P1), UMA POR PROJETO
-- Cada esteira pode ter projetos. Quando o lead entra numa coluna (P1, P2...),
-- vai para a esteira do projeto dele; sem esteira do projeto, vai para uma esteira
-- sem projetos (geral); se não houver, para a primeira pela ordem.
-- Clique em Run uma única vez.

alter table public.esteiras add column if not exists empreendimento_ids uuid[] not null default '{}';

create or replace function public.lead_esteira_por_etapa()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_esteira uuid;
  v_idx int;
  v_total int;
  v_dias int;
  v_espera int;
begin
  if tg_op = 'UPDATE' then
    if new.status is not distinct from old.status then
      return new;
    end if;
    -- o envio da esteira já posicionou o lead
    if new.esteira_id is distinct from old.esteira_id
       or new.esteira_passo is distinct from old.esteira_passo then
      return new;
    end if;
  end if;

  -- 1) coluna de um passo (ex.: P3 = passo 3): continua na esteira atual;
  --    senão, a esteira do projeto do lead; senão, uma geral; senão, a primeira
  select p.esteira_id, p.idx into v_esteira, v_idx
  from (
    select ep.esteira_id, ep.etapa, e.ordem as e_ordem, e.empreendimento_ids as projs,
           row_number() over (partition by ep.esteira_id order by ep.ordem, ep.created_at) - 1 as idx
    from public.esteira_passos ep
    join public.esteiras e on e.id = ep.esteira_id
    where e.user_id = new.user_id
  ) p
  where p.etapa is not null
    and lower(trim(p.etapa)) = lower(trim(coalesce(new.status, '')))
  order by (p.esteira_id = new.esteira_id) desc nulls last,
           (new.empreendimento_id is not null and new.empreendimento_id = any(p.projs)) desc,
           (cardinality(p.projs) = 0) desc,
           p.e_ordem
  limit 1;

  if v_esteira is not null then
    select count(*) into v_total from public.esteira_passos where esteira_id = v_esteira;
    if v_idx + 1 >= v_total then
      -- último passo: espera os dias sem resposta antes de finalizar
      select coalesce(ao_concluir_dias, 0) into v_espera from public.esteiras where id = v_esteira;
      if coalesce(v_espera, 0) > 0 then
        new.esteira_id := v_esteira;
        new.esteira_passo := v_total;
        new.esteira_proximo := now() + make_interval(days => v_espera);
      else
        new.esteira_id := null;
        new.esteira_passo := 0;
        new.esteira_proximo := null;
      end if;
    else
      select coalesce(dias_espera, 1) into v_dias
      from public.esteira_passos
      where esteira_id = v_esteira
      order by ordem, created_at
      offset v_idx + 1 limit 1;
      new.esteira_id := v_esteira;
      new.esteira_passo := v_idx + 1;
      new.esteira_proximo := now() + make_interval(days => coalesce(v_dias, 1));
    end if;
    return new;
  end if;

  -- 2) coluna de entrada: esteira do projeto do lead; senão, uma geral; senão, a primeira
  select e.id into v_esteira
  from public.esteiras e
  where e.user_id = new.user_id
    and e.etapa is not null
    and lower(trim(e.etapa)) = lower(trim(coalesce(new.status, '')))
  order by (new.empreendimento_id is not null and new.empreendimento_id = any(e.empreendimento_ids)) desc,
           (cardinality(e.empreendimento_ids) = 0) desc,
           e.ordem, e.created_at
  limit 1;

  if v_esteira is not null then
    if new.esteira_id is distinct from v_esteira then
      new.esteira_id := v_esteira;
      new.esteira_passo := 0;
      new.esteira_proximo := now();
    end if;
  -- 3) saiu das colunas ligadas
  elsif new.esteira_id is not null
        and (exists (select 1 from public.esteiras e where e.id = new.esteira_id and e.etapa is not null)
             or exists (select 1 from public.esteira_passos ep where ep.esteira_id = new.esteira_id and ep.etapa is not null)) then
    new.esteira_id := null;
    new.esteira_passo := 0;
    new.esteira_proximo := null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_lead_esteira_por_etapa on public.leads;
create trigger trg_lead_esteira_por_etapa
before insert or update of status on public.leads
for each row execute function public.lead_esteira_por_etapa();

notify pgrst, 'reload schema';

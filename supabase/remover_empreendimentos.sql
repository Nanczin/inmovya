-- REMOVE O MÓDULO EMPREENDIMENTOS DO BANCO (DEFINITIVO)
-- Apaga a tabela de empreendimentos e as colunas ligadas a ela em leads, campanhas,
-- materiais e esteiras, além das versões por projeto dos passos.
-- A pasta de arquivos "empreendimentos" do Storage NÃO é apagada: ela guarda as imagens
-- e arquivos dos Templates e do E-mail marketing.
-- Clique em Run uma única vez.

-- 1) Esteiras: várias esteiras podem usar a mesma coluna (ex.: P1).
--    Uma esteira só na coluna: o lead entra sozinho (como antes).
--    Mais de uma: o lead continua na esteira em que já está; se não está em nenhuma delas,
--    não entra sozinho (você escolhe a esteira).
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
  v_qtd int;
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

  -- 1) coluna de um passo (ex.: P3 = passo 3)
  select count(distinct ep.esteira_id) into v_qtd
  from public.esteira_passos ep
  join public.esteiras e on e.id = ep.esteira_id
  where e.user_id = new.user_id
    and ep.etapa is not null
    and lower(trim(ep.etapa)) = lower(trim(coalesce(new.status, '')));

  if v_qtd > 0 then
    select p.esteira_id, p.idx into v_esteira, v_idx
    from (
      select ep.esteira_id, ep.etapa,
             row_number() over (partition by ep.esteira_id order by ep.ordem, ep.created_at) - 1 as idx
      from public.esteira_passos ep
      join public.esteiras e on e.id = ep.esteira_id
      where e.user_id = new.user_id
    ) p
    where p.etapa is not null
      and lower(trim(p.etapa)) = lower(trim(coalesce(new.status, '')))
      and (p.esteira_id = new.esteira_id or v_qtd = 1)
    order by (p.esteira_id = new.esteira_id) desc nulls last
    limit 1;

    if v_esteira is null then
      -- várias esteiras nesta coluna e o lead não está em nenhuma: você escolhe
      new.esteira_id := null;
      new.esteira_passo := 0;
      new.esteira_proximo := null;
      return new;
    end if;

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

  -- 2) coluna de entrada de esteira(s)
  select count(*) into v_qtd
  from public.esteiras e
  where e.user_id = new.user_id
    and e.etapa is not null
    and lower(trim(e.etapa)) = lower(trim(coalesce(new.status, '')));

  if v_qtd > 0 then
    select e.id into v_esteira
    from public.esteiras e
    where e.user_id = new.user_id
      and e.etapa is not null
      and lower(trim(e.etapa)) = lower(trim(coalesce(new.status, '')))
      and (e.id = new.esteira_id or v_qtd = 1)
    order by (e.id = new.esteira_id) desc nulls last, e.ordem, e.created_at
    limit 1;

    if v_esteira is null then
      -- várias esteiras nesta coluna: o lead não entra sozinho
      new.esteira_id := null;
      new.esteira_passo := 0;
      new.esteira_proximo := null;
    elsif new.esteira_id is distinct from v_esteira then
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

-- 2) Colunas ligadas a empreendimentos
alter table public.esteira_passos drop column if exists variantes;
alter table public.esteiras drop column if exists empreendimento_ids;
alter table public.esteiras drop column if exists empreendimento_id;
alter table public.leads drop column if exists empreendimento_id;
alter table public.campanhas drop column if exists empreendimento_id;
alter table public.materiais drop column if exists empreendimento_id;

-- interesse em empreendimento guardado nos contatos das listas (Ligações)
update public.contatos
set dados_extras = dados_extras - 'empreendimento_interesse'
where dados_extras ? 'empreendimento_interesse';

-- 3) Permissões do módulo e a tabela
delete from public.module_permissions where module_name = 'empreendimentos';
drop table if exists public.empreendimentos cascade;

notify pgrst, 'reload schema';

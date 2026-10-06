-- FIM DA ESTEIRA SEM RESPOSTA: espera X dias depois do último passo,
-- move o card para a coluna escolhida (ex.: Perdido) e coloca a etiqueta escolhida (ex.: disparo).
-- Clique em Run uma única vez.

alter table public.esteiras add column if not exists ao_concluir_dias int not null default 0;

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

  -- 1) coluna de um passo
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
  order by (p.esteira_id = new.esteira_id) desc nulls last
  limit 1;

  if v_esteira is not null then
    select count(*) into v_total from public.esteira_passos where esteira_id = v_esteira;
    if v_idx + 1 >= v_total then
      -- último passo: espera os dias sem resposta antes de finalizar (Perdido + etiqueta)
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

  -- 2) coluna de entrada de uma esteira
  select e.id into v_esteira
  from public.esteiras e
  where e.user_id = new.user_id
    and e.etapa is not null
    and lower(trim(e.etapa)) = lower(trim(coalesce(new.status, '')))
  order by e.ordem, e.created_at
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

-- Finaliza quem passou do último passo e não respondeu dentro do prazo
create or replace function public.finalizar_esteiras_vencidas()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  with alvo as (
    select l.id, e.ao_concluir_etapa, nullif(trim(coalesce(e.ao_concluir_tag, '')), '') as tag
    from public.leads l
    join public.esteiras e on e.id = l.esteira_id
    where l.esteira_proximo is not null
      and l.esteira_proximo <= now()
      and l.esteira_passo >= (select count(*) from public.esteira_passos p where p.esteira_id = e.id)
      and (auth.uid() is null or l.user_id = auth.uid())
  )
  update public.leads l
  set esteira_id = null,
      esteira_passo = 0,
      esteira_proximo = null,
      status = case
        when nullif(trim(coalesce(a.ao_concluir_etapa, '')), '') is not null then trim(a.ao_concluir_etapa)
        when a.tag is not null then null
        else l.status
      end,
      tags = case
        when a.tag is null or a.tag = any(coalesce(l.tags, '{}')) then l.tags
        else array_append(coalesce(l.tags, '{}'), a.tag)
      end
  from alvo a
  where l.id = a.id;
  get diagnostics n = row_count;
  return n;
end;
$$;

grant execute on function public.finalizar_esteiras_vencidas() to authenticated;

-- Roda sozinho a cada 30 minutos (mesmo com o Inmovya fechado)
do $$ begin
  perform cron.unschedule('finalizar-esteiras') where exists (select 1 from cron.job where jobname = 'finalizar-esteiras');
  perform cron.schedule('finalizar-esteiras', '*/30 * * * *', 'select public.finalizar_esteiras_vencidas();');
end $$;

notify pgrst, 'reload schema';

-- A esteira de prospecção já criada passa a terminar em Perdido + disparo, 1 dia depois do P7
update public.esteiras
set ao_concluir_etapa = 'Perdido',
    ao_concluir_tag = coalesce(nullif(trim(ao_concluir_tag), ''), 'disparo'),
    ao_concluir_dias = 1
where nome = 'Prospecção P1–P7' and coalesce(ao_concluir_etapa, '') in ('', 'Lista fria');

-- FIM DE ESTEIRA NO SERVIDOR + MOVER COLUNA NÃO CONTA COMO ENVIO
-- Rode no Supabase (SQL Editor → colar tudo → Run). Pode rodar mais de uma vez sem problema.
--
-- 1) Mover o card de coluna (ex.: P1 → P2) NÃO marca passo como enviado.
-- 2) De hora em hora o banco finaliza, sozinho, quem passou do prazo depois do ÚLTIMO passo sem responder:
--    move para "Ao terminar sem resposta, mover para" (ex.: Lista fria), acrescenta as
--    "Etiquetas ao terminar sem resposta" (ex.: disparo) sem tirar as que já existem e tira da esteira.
--    Prazo = "dias sem resposta" da esteira; se 0, o intervalo do último passo; se 0, 1 dia.
--    "Respondeu" = o card foi para a coluna Respondeu (ou Interessado): esse lead sai da esteira e nunca vai para a Lista fria.

-- pg_cron (agendador do Supabase). Se der erro aqui, ative em Database → Extensions → pg_cron e rode de novo.
create extension if not exists pg_cron;

-- ---------------------------------------------------------------------------------------------
-- 1) Regra ao mudar a coluna (status) do lead no Negócios
-- ---------------------------------------------------------------------------------------------
create or replace function public.lead_esteira_por_etapa()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_esteira uuid;
  v_idx int;
begin
  if tg_op = 'UPDATE' then
    if new.status is not distinct from old.status then
      return new;
    end if;
    -- o envio da esteira (ou a finalização) já posicionou o lead: não interfere
    if new.esteira_id is distinct from old.esteira_id
       or new.esteira_passo is distinct from old.esteira_passo then
      return new;
    end if;
  end if;

  -- a) coluna de um passo (ex.: P2)
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
    if new.esteira_id = v_esteira then
      -- mesma esteira: só o card muda de coluna. NÃO conta como passo enviado (antes pulava o envio do dia).
      return new;
    end if;
    -- fora da esteira (ou em outra): entra nesta esteira NO passo da coluna, ainda NÃO enviado, para hoje
    new.esteira_id := v_esteira;
    new.esteira_passo := v_idx;
    new.esteira_proximo := now();
    return new;
  end if;

  -- b) coluna de entrada de uma esteira (ex.: Primeiro impacto, 20%, 50%): entra no 1º passo
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
  -- c) foi para outra coluna (ex.: Respondeu): sai da esteira ligada ao Negócios
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

-- ---------------------------------------------------------------------------------------------
-- 2) Finaliza quem terminou a esteira e não respondeu no prazo (idempotente)
-- ---------------------------------------------------------------------------------------------
create or replace function public.finalizar_esteiras_vencidas()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  with tot as (
    select esteira_id, count(*) as total
    from public.esteira_passos
    group by esteira_id
  ),
  ultimo as (
    select distinct on (esteira_id) esteira_id, coalesce(dias_espera, 0) as dias
    from public.esteira_passos
    order by esteira_id, ordem desc, created_at desc
  ),
  alvo as (
    select l.id,
           e.nome,
           nullif(trim(coalesce(e.ao_concluir_etapa, '')), '') as etapa_fim,
           coalesce(
             array(select distinct trim(x) from unnest(string_to_array(coalesce(e.ao_concluir_tag, ''), ',')) x where trim(x) <> ''),
             '{}'::text[]
           ) as novas
    from public.leads l
    join public.esteiras e on e.id = l.esteira_id
    join tot t on t.esteira_id = e.id
    left join ultimo u on u.esteira_id = e.id
    where l.esteira_id is not null
      and coalesce(l.esteira_passo, 0) >= t.total                 -- já recebeu o último passo
      and lower(trim(coalesce(l.status, ''))) not in ('respondeu', 'interessado')  -- não respondeu
      and (
        (l.esteira_ultimo_envio is not null
         and l.esteira_ultimo_envio
             + make_interval(days => greatest(1, coalesce(nullif(e.ao_concluir_dias, 0), nullif(u.dias, 0), 1))) <= now())
        or (l.esteira_ultimo_envio is null and l.esteira_proximo is not null and l.esteira_proximo <= now())
      )
      and (auth.uid() is null or l.user_id = auth.uid())
  ),
  feito as (
    update public.leads l
    set esteira_id = null,
        esteira_passo = 0,
        esteira_proximo = null,
        status = case
          when a.etapa_fim is not null then a.etapa_fim
          when cardinality(a.novas) > 0 then null
          else l.status
        end,
        -- acrescenta sem duplicar e sem tirar as que já existem
        tags = coalesce(l.tags, '{}') || array(
          select t from unnest(a.novas) t where not (t = any(coalesce(l.tags, '{}')))
        )
    from alvo a
    where l.id = a.id
    returning l.id, a.nome, a.etapa_fim, a.novas
  )
  insert into public.lead_timeline (lead_id, type, title, description, author)
  select f.id,
         'note',
         'Esteira ' || f.nome || ' — fim sem resposta',
         'Movido para ' || coalesce(f.etapa_fim, '(fora do funil)')
           || case when cardinality(f.novas) > 0 then '; etiquetas: ' || array_to_string(f.novas, ', ') else '' end
           || '. Finalizado automaticamente.',
         'Esteira'
  from feito f;
  get diagnostics n = row_count;
  return n;
end;
$$;

grant execute on function public.finalizar_esteiras_vencidas() to authenticated;

-- De hora em hora, no servidor (não depende do Inmovya aberto)
do $$ begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'finalizar-esteiras';
  perform cron.schedule('finalizar-esteiras', '0 * * * *', 'select public.finalizar_esteiras_vencidas();');
end $$;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------------------------
-- 3) (OPCIONAL) Leads que ficaram presos na última coluna SEM esteira e SEM a etiqueta (bug antigo)
--    Primeiro veja a lista (rode só o SELECT). Se estiver certa, rode o UPDATE logo abaixo.
-- ---------------------------------------------------------------------------------------------
-- with ult as (
--   select distinct on (ep.esteira_id) ep.esteira_id, ep.etapa
--   from public.esteira_passos ep order by ep.esteira_id, ep.ordem desc, ep.created_at desc
-- )
-- select l.id, l.nome, l.status, l.tags, e.nome as esteira, e.ao_concluir_etapa, e.ao_concluir_tag
-- from public.leads l
-- join ult on lower(trim(ult.etapa)) = lower(trim(l.status))
-- join public.esteiras e on e.id = ult.esteira_id and e.user_id = l.user_id
-- where l.esteira_id is null;
--
-- -- UPDATE (só depois de conferir a lista acima):
-- with ult as (
--   select distinct on (ep.esteira_id) ep.esteira_id, ep.etapa
--   from public.esteira_passos ep order by ep.esteira_id, ep.ordem desc, ep.created_at desc
-- ), alvo as (
--   select l.id, nullif(trim(coalesce(e.ao_concluir_etapa, '')), '') as etapa_fim,
--          array(select distinct trim(x) from unnest(string_to_array(coalesce(e.ao_concluir_tag, ''), ',')) x where trim(x) <> '') as novas
--   from public.leads l
--   join ult on lower(trim(ult.etapa)) = lower(trim(l.status))
--   join public.esteiras e on e.id = ult.esteira_id and e.user_id = l.user_id
--   where l.esteira_id is null
-- )
-- update public.leads l
-- set status = coalesce(a.etapa_fim, l.status),
--     tags = coalesce(l.tags, '{}') || array(select t from unnest(a.novas) t where not (t = any(coalesce(l.tags, '{}'))))
-- from alvo a where l.id = a.id;

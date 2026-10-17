-- ESTEIRA E NEGÓCIOS ANDANDO JUNTOS: a coluna do card é sempre o DIA em que o lead está na esteira.
--  • enviou o D1 → o card vai para a coluna do D2 (o próximo envio). No último dia fica na coluna dele.
--  • arrastar o card para a coluna de um dia (ex.: P3) → a esteira vai para esse dia, com envio hoje.
--  • escolher o dia no menu do card → o card vai para a coluna desse dia.
-- Este arquivo também acerta os cards que hoje estão uma coluna atrás do dia da esteira.
-- Rode no Supabase: SQL Editor → colar tudo → Run. Pode rodar mais de uma vez.

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

  -- a) coluna de um passo (ex.: P2) — prefere a esteira em que o lead já está
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
    -- mesma esteira em outro passo, ou outra esteira: vai para o passo da coluna, ainda NÃO enviado, para hoje
    -- já está nesse dia (ou já recebeu o último e está aguardando resposta na coluna dele): não mexe
    if new.esteira_id is distinct from v_esteira
       or (coalesce(new.esteira_passo, 0) <> v_idx
           and not (coalesce(new.esteira_passo, 0) >= v_idx + 1
                    and v_idx = (select count(*) - 1 from public.esteira_passos where esteira_id = v_esteira))) then
      new.esteira_id := v_esteira;
      new.esteira_passo := v_idx;
      new.esteira_proximo := now();
    end if;
    return new;
  end if;

  -- b) coluna de entrada de uma esteira (ex.: Primeiro impacto, 20%, 50%): 1º passo
  select e.id into v_esteira
  from public.esteiras e
  where e.user_id = new.user_id
    and e.etapa is not null
    and lower(trim(e.etapa)) = lower(trim(coalesce(new.status, '')))
  order by (e.id = new.esteira_id) desc nulls last, e.ordem, e.created_at
  limit 1;

  if v_esteira is not null then
    if new.esteira_id is distinct from v_esteira or coalesce(new.esteira_passo, 0) <> 0 then
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

-- Acerta os leads que já estão numa coluna de dia da esteira, mas uma coluna atrás (regra antiga)
with passos as (
  select ep.esteira_id, ep.etapa,
         row_number() over (partition by ep.esteira_id order by ep.ordem, ep.created_at) - 1 as idx,
         count(*) over (partition by ep.esteira_id) as total
  from public.esteira_passos ep
),
alvo as (
  select l.id, p.etapa
  from public.leads l
  join passos p on p.esteira_id = l.esteira_id
               and p.idx = least(coalesce(l.esteira_passo, 0), p.total - 1)
  where l.esteira_id is not null
    and coalesce(trim(p.etapa), '') <> ''
    and lower(trim(coalesce(l.status, ''))) <> lower(trim(p.etapa))
    and exists (
      select 1 from passos q
      where q.esteira_id = l.esteira_id
        and lower(trim(coalesce(q.etapa, ''))) = lower(trim(coalesce(l.status, '')))
    )
)
update public.leads l
set status = a.etapa
from alvo a
where l.id = a.id;

notify pgrst, 'reload schema';

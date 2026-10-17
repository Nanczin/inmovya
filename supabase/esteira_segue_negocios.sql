-- ESTEIRA SEGUE O NEGÓCIOS: quando o card muda de coluna, a esteira do lead acompanha.
--  • coluna de um PASSO (ex.: P3): o lead fica na esteira NESSE passo, com envio para hoje
--    (também quando já estava na mesma esteira em outro passo — antes só o card mudava);
--  • coluna de ENTRADA de uma esteira (ex.: Primeiro impacto, 20%): volta para o 1º passo, envio hoje;
--  • qualquer outra coluna (ex.: Respondeu, Diagnóstico): sai da esteira ligada ao Negócios.
-- O envio da própria esteira (que muda coluna e passo juntos) e a finalização no servidor não são afetados.
-- Clique em Run uma única vez.

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

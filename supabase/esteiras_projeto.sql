-- ESTEIRAS POR PROJETO (empreendimento)
-- Clique em Run uma única vez.

alter table public.esteiras add column if not exists empreendimento_id uuid references public.empreendimentos(id) on delete set null;

-- Etapa + projeto definem a esteira do lead.
-- Procura primeiro a esteira da etapa para o projeto do lead; se não houver, usa a esteira geral da etapa.
create or replace function public.lead_esteira_por_etapa()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_esteira uuid;
begin
  if tg_op = 'UPDATE'
     and new.status is not distinct from old.status
     and new.empreendimento_id is not distinct from old.empreendimento_id then
    return new;
  end if;

  select e.id into v_esteira
  from public.esteiras e
  where e.user_id = new.user_id
    and e.etapa is not null
    and lower(trim(e.etapa)) = lower(trim(coalesce(new.status, '')))
    and (e.empreendimento_id is null or e.empreendimento_id = new.empreendimento_id)
  order by (e.empreendimento_id is null), e.ordem, e.created_at
  limit 1;

  if v_esteira is not null then
    if new.esteira_id is distinct from v_esteira then
      new.esteira_id := v_esteira;
      new.esteira_passo := 0;
      new.esteira_proximo := now();
    end if;
  elsif new.esteira_id is not null
        and exists (select 1 from public.esteiras e where e.id = new.esteira_id and e.etapa is not null) then
    new.esteira_id := null;
    new.esteira_passo := 0;
    new.esteira_proximo := null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_lead_esteira_por_etapa on public.leads;
create trigger trg_lead_esteira_por_etapa
before insert or update of status, empreendimento_id on public.leads
for each row execute function public.lead_esteira_por_etapa();

notify pgrst, 'reload schema';

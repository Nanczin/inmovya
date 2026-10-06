-- VÁRIAS ETIQUETAS AO TERMINAR A ESTEIRA (ex.: disparo, nutrição)
-- Clique em Run uma única vez.

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
    select l.id,
           e.ao_concluir_etapa,
           coalesce(
             array(select distinct trim(x) from unnest(string_to_array(coalesce(e.ao_concluir_tag, ''), ',')) x where trim(x) <> ''),
             '{}'::text[]
           ) as novas
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
        when cardinality(a.novas) > 0 then null
        else l.status
      end,
      tags = coalesce(l.tags, '{}') || array(
        select t from unnest(a.novas) t where not (t = any(coalesce(l.tags, '{}')))
      )
  from alvo a
  where l.id = a.id;
  get diagnostics n = row_count;
  return n;
end;
$$;

grant execute on function public.finalizar_esteiras_vencidas() to authenticated;
notify pgrst, 'reload schema';

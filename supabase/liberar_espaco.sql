-- LIBERAR ESPAÇO DO BANCO (aba Configurações do Inmovya → "Liberar espaço")
-- O que enche o banco não são os seus dados (leads, ligações etc. somam poucos MB):
-- é o histórico das tarefas automáticas (cron), que registra uma linha por minuto desde 2025.
-- PASSO 1: cole tudo no Supabase → SQL Editor → Run.

do $$
begin
  -- histórico das tarefas automáticas: guarda só os últimos 2 dias
  begin
    delete from cron.job_run_details where end_time < now() - interval '2 days';
  exception when others then raise notice 'cron: %', sqlerrm;
  end;
  -- respostas antigas das chamadas automáticas
  begin
    delete from net._http_response where created < now() - interval '1 day';
  exception when others then raise notice 'net: %', sqlerrm;
  end;
  -- daqui para frente, limpa sozinho todo dia às 3h17
  begin
    perform cron.unschedule('limpar-historico-cron');
  exception when others then null;
  end;
  begin
    perform cron.schedule('limpar-historico-cron', '17 3 * * *',
      $c$delete from cron.job_run_details where end_time < now() - interval '2 days'$c$);
  exception when others then raise notice 'agendar limpeza: %', sqlerrm;
  end;
end $$;

-- a medição da aba Configurações passa a mostrar também essas áreas do sistema
create or replace function public.uso_banco()
returns json
language sql
security definer
set search_path = public
as $$
  select json_build_object(
    'banco_bytes', pg_database_size(current_database()),
    'tabelas', (
      select coalesce(json_agg(t), '[]'::json)
      from (
        select case when n.nspname = 'public' then c.relname else n.nspname || '.' || c.relname end as nome,
               pg_total_relation_size(c.oid) as bytes,
               greatest(c.reltuples, 0)::bigint as linhas
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname not in ('pg_catalog', 'information_schema', 'pg_toast') and c.relkind in ('r', 'm')
        order by pg_total_relation_size(c.oid) desc
        limit 12
      ) t
    ),
    'storage_bytes', (
      select coalesce(sum((o.metadata->>'size')::bigint), 0)
      from storage.objects o
    ),
    'medido_em', now()
  );
$$;

revoke all on function public.uso_banco() from public, anon;
grant execute on function public.uso_banco() to authenticated;
notify pgrst, 'reload schema';

-- PASSO 2 (separado, depois do passo 1): apague o texto do editor, cole só a linha abaixo e clique em Run.
-- VACUUM FULL cron.job_run_details;

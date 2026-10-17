-- USO DO BANCO (aba Configurações do Inmovya)
-- Rode uma vez no Supabase: SQL Editor → colar tudo → Run.
-- Mostra quanto o banco ocupa, as maiores tabelas e quanto os arquivos (Storage) ocupam.

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
        select c.relname as nome,
               pg_total_relation_size(c.oid) as bytes,
               greatest(c.reltuples, 0)::bigint as linhas
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r'
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

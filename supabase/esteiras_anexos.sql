-- ANEXOS NAS ESTEIRAS (PDF, vídeo, imagem, áudio, documentos)
-- Clique em Run uma única vez.

alter table public.esteira_passos add column if not exists anexos jsonb not null default '[]'::jsonb;

-- Pasta privada para os arquivos das esteiras (cada usuário só vê os próprios)
insert into storage.buckets (id, name, public, file_size_limit)
values ('esteira-anexos', 'esteira-anexos', false, 20971520)
on conflict (id) do update set file_size_limit = excluded.file_size_limit;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'esteira anexos - ler os proprios') then
    create policy "esteira anexos - ler os proprios" on storage.objects
      for select to authenticated
      using (bucket_id = 'esteira-anexos' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'esteira anexos - enviar os proprios') then
    create policy "esteira anexos - enviar os proprios" on storage.objects
      for insert to authenticated
      with check (bucket_id = 'esteira-anexos' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'esteira anexos - apagar os proprios') then
    create policy "esteira anexos - apagar os proprios" on storage.objects
      for delete to authenticated
      using (bucket_id = 'esteira-anexos' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
end $$;

notify pgrst, 'reload schema';

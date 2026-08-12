create table if not exists mensagem_templates (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo text not null check (tipo in ('whatsapp', 'email')),
  conteudo text not null,
  assunto text, -- Apenas para email
  categoria text,
  created_at timestamp with time zone default now()
);

-- Habilitar RLS (opcional, mas recomendado)
alter table mensagem_templates enable row level security;

-- Política de leitura pública (ajusat conforme necessidade)
create policy "Templates são visíveis para todos" on mensagem_templates for select using (true);

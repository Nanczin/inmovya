# Configuração Obrigatória - Notificações Push

Como eu não tenho acesso à sua chave administrativa (Service Role) do Supabase, você precisa aplicar estas configurações manualmente no painel para que as notificações funcionem.

## 1. Criar Tabela no Banco de Dados

1. Acesse o **SQL Editor** no painel do Supabase: [https://supabase.com/dashboard/project/_/sql](https://supabase.com/dashboard/project/_/sql)
2. Cole e execute o seguinte código:

```sql
create table if not exists public.user_push_subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  subscription jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, subscription)
);

alter table public.user_push_subscriptions enable row level security;

create policy "Users can insert their own subscriptions"
  on public.user_push_subscriptions for insert
  with check (auth.uid() = user_id);

create policy "Users can view their own subscriptions"
  on public.user_push_subscriptions for select
  using (auth.uid() = user_id);

create policy "Users can delete their own subscriptions"
  on public.user_push_subscriptions for delete
  using (auth.uid() = user_id);
```

## 2. Configurar Segredos da Função (Secrets)

1. Vá em **Edge Functions** no menu lateral.
2. Clique em **Manage Secrets** (ou Secrets).
3. Adicione as seguintes variáveis (copie exatamente):

| Name | Value |
|------|-------|
| `VAPID_PUBLIC_KEY` | `BK92_w8EsZQ_6sJApDMTLotu-iToHzgjcuVttmgl0AVprNy2eMxiAdyXf-ZgyvmJ40DMM3SHvbqDtVIOwo3IIFc` |
| `VAPID_PRIVATE_KEY` | `Vm-VVcaY1i_oQWr12O_66_euExkTbbHkupvozqjjJ2o` |
| `SUPABASE_URL` | `https://hhtzdxtythejyykrpgqw.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | *(Pegue esta chave em Project Settings > API > service_role key)* |

## 3. Fazer Deploy da Função

No seu terminal do VS Code, execute:

```bash
npx supabase functions deploy send-reminders --no-verify-jwt
```

*(Se pedir para logar, rode `npx supabase login` e cole o token).*

## 4. Testar

Após configurar, abra o app, aceite a permissão de notificação. Crie um lembrete para testar.

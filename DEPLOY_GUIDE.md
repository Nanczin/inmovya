# 🚀 Guia de Deploy - GitHub e Vercel

## 📋 Pré-requisitos

Antes de começar, certifique-se de ter:
- Conta no GitHub
- Conta na Vercel
- Git instalado localmente

## 🔧 Passo 1: Preparar o Repositório Git

### 1.1 Verificar se já existe um repositório
```bash
git status
```

### 1.2 Se NÃO existir, inicializar
```bash
git init
git add .
git commit -m "feat: sistema de notificações globais de lembretes"
```

### 1.3 Se JÁ existir, fazer commit das alterações
```bash
git add .
git commit -m "feat: sistema de notificações globais de lembretes"
```

## 📤 Passo 2: Enviar para o GitHub

### 2.1 Criar repositório no GitHub
1. Acesse: https://github.com/new
2. Nome do repositório: `inmovya` (ou outro nome de sua preferência)
3. Deixe como **privado** (recomendado)
4. **NÃO** inicialize com README, .gitignore ou licença
5. Clique em "Create repository"

### 2.2 Conectar o repositório local ao GitHub

**IMPORTANTE**: Substitua `SEU_USUARIO` pelo seu nome de usuário do GitHub

```bash
git remote add origin https://github.com/SEU_USUARIO/inmovya.git
git branch -M main
git push -u origin main
```

**Se pedir autenticação:**
- Use seu nome de usuário do GitHub
- Como senha, use um **Personal Access Token** (não a senha da conta)
- Para criar um token: https://github.com/settings/tokens

## 🌐 Passo 3: Deploy na Vercel

### Opção A: Via Interface Web (Recomendado)

1. Acesse: https://vercel.com
2. Faça login com sua conta
3. Clique em "Add New..." → "Project"
4. Importe o repositório do GitHub que você acabou de criar
5. Configure o projeto:
   - **Framework Preset**: Vite
   - **Root Directory**: `./` (deixe como está)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

6. **Variáveis de Ambiente** (IMPORTANTE):
   Clique em "Environment Variables" e adicione:
   
   ```
   VITE_SUPABASE_URL=sua_url_do_supabase
   VITE_SUPABASE_ANON_KEY=sua_chave_anonima_do_supabase
   ```
   
   **Onde encontrar essas informações:**
   - Acesse seu projeto no Supabase
   - Vá em Settings → API
   - Copie a "Project URL" e a "anon/public key"

7. Clique em "Deploy"

### Opção B: Via CLI da Vercel

```bash
# Instalar Vercel CLI
npm install -g vercel

# Fazer login
vercel login

# Deploy
vercel

# Seguir as instruções no terminal
```

## 🔄 Passo 4: Configurar Deploy Automático

Após o primeiro deploy, a Vercel automaticamente:
- ✅ Faz deploy a cada push na branch `main`
- ✅ Cria preview para cada Pull Request
- ✅ Mostra logs de build em tempo real

## 📝 Passo 5: Verificar o Deploy

1. Após o deploy, a Vercel fornecerá uma URL como:
   ```
   https://inmovya.vercel.app
   ```

2. Acesse a URL e verifique se tudo está funcionando

3. Teste especialmente:
   - ✅ Login
   - ✅ Notificações de lembretes
   - ✅ Mapa de jornada do lead
   - ✅ PWA (instalar no celular)

## 🐛 Solução de Problemas

### Erro: "Build failed"
- Verifique os logs na Vercel
- Certifique-se de que `npm run build` funciona localmente
- Verifique se todas as variáveis de ambiente estão configuradas

### Erro: "Supabase connection failed"
- Verifique se as variáveis de ambiente estão corretas
- Certifique-se de que a URL do Supabase está acessível

### Erro: "Git authentication failed"
- Use um Personal Access Token ao invés da senha
- Crie em: https://github.com/settings/tokens
- Permissões necessárias: `repo` (full control)

## 🔐 Segurança

**NUNCA** commite:
- ❌ Arquivos `.env` com credenciais
- ❌ Chaves de API no código
- ❌ Senhas ou tokens

**SEMPRE** use:
- ✅ Variáveis de ambiente na Vercel
- ✅ `.gitignore` para arquivos sensíveis
- ✅ Secrets do GitHub para CI/CD

## 📱 Domínio Personalizado (Opcional)

Se você tiver um domínio próprio:

1. Na Vercel, vá em Settings → Domains
2. Adicione seu domínio
3. Configure os DNS conforme instruções da Vercel

## 🎉 Pronto!

Seu projeto agora está:
- ✅ Versionado no GitHub
- ✅ Deployado na Vercel
- ✅ Com deploy automático configurado
- ✅ Acessível via URL pública

---

## 📞 Comandos Rápidos para Próximos Deploys

```bash
# 1. Fazer alterações no código
# 2. Commitar
git add .
git commit -m "descrição das alterações"

# 3. Enviar para GitHub (deploy automático na Vercel)
git push
```

A Vercel detectará automaticamente o push e fará o deploy! 🚀

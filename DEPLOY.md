# Guia de Deploy - Inmovya (GitHub & Vercel)

Este guia orienta como subir seu projeto para o GitHub e colocá-lo no ar usando a Vercel.

## 1. Preparar o Repositório Local (Git)

Você já está na pasta do projeto. Abra o terminal e siga os passos:

1. Adicione todos os arquivos e faça o primeiro commit:
   ```bash
   git add .
   git commit -m "Primeiro commit - Projeto Inmovya"
   git branch -M main
   ```

## 2. Enviar para o GitHub

1. Acesse [github.com/new](https://github.com/new) e crie um novo repositório (ex: `inmovya-app`).
2. **Não** marque as opções de adicionar README, .gitignore ou license (pois seu projeto já tem).
3. Após criar, copie o link HTTPS do repositório (algo como `https://github.com/seu-usuario/inmovya-app.git`).
4. No terminal do VS Code, conecte seu projeto ao GitHub:
   ```bash
   git remote add origin <COLE_A_URL_DO_GITHUB_AQUI>
   git push -u origin main
   ```

## 3. Deploy na Vercel

1. Crie uma conta ou faça login em [vercel.com](https://vercel.com) (recomendado logar com GitHub).
2. No dashboard, clique em **"Add New..."** -> **"Project"**.
3. Na lista "Import Git Repository", encontre seu repositório `inmovya-app` e clique em **Import**.
4. **Configuração de Build** (Geralmente a Vercel detecta Vite automaticamente):
   - Framework Preset: `Vite`
   - Root Directory: `./` (padrão)
   - **Nota**: O arquivo `vercel.json` já foi criado automaticamente para configurar os proxies (LlamaLab/Supabase), então não precisa configurar Rewrites manualmente.

5. **Variáveis de Ambiente (MUITO IMPORTANTE):**
   - Expanda a seção **"Environment Variables"**.
   - Você precisa copiar as chaves do seu arquivo `.env` local para cá.
   - Abra seu arquivo `.env` no VS Code e copie cada par chave-valor.
   - Exemplos típicos:
     - `VITE_SUPABASE_URL`: sua_url_do_supabase
     - `VITE_SUPABASE_ANON_KEY`: sua_key_anonima
   - **Nota:** Não inclua aspas nas variáveis na Vercel a menos que seja estritamente necessário.

6. Clique em **Deploy**.

## 4. Finalização

- Aguarde o processo de build. Se tudo der certo, você receberá uma URL (ex: `inmovya-app.vercel.app`) onde seu sistema estará rodando publicamente.
- Para atualizar o site no futuro, basta fazer alterações no código, commitar e dar `git push`. A Vercel detectará a mudança e fará o deploy automático.

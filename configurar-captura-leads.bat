@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
cd /d "%~dp0"
set PROJECT=hhtzdxtythejyykrpgqw
set URL=https://%PROJECT%.supabase.co/functions/v1/lead-intake

echo.
echo ==========================================================
echo   Captura automatica de leads - configuracao do Inmovya
echo ==========================================================
echo.
echo 1/4 Login no Supabase (vai abrir o navegador; confirme o acesso)
call npx -y supabase login
if errorlevel 1 goto erro

echo.
echo 2/4 Dados de configuracao (deixe em branco o que ainda nao tiver)
set /p EMAIL=   E-mail do seu login no Inmovya (dono dos leads): 
if "!EMAIL!"=="" goto erro_email
set /p METATOKEN=   Token da pagina da Meta (leads_retrieval) [opcional]: 
set /p METASECRET=   App Secret do app da Meta [opcional]: 
set /p BITRIXURL=   Webhook de ENTRADA do Bitrix (https://.../rest/1/xxxx/) [opcional]: 

for /f %%i in ('powershell -NoProfile -Command "[guid]::NewGuid().ToString('N')"') do set INTAKESECRET=%%i
for /f %%i in ('powershell -NoProfile -Command "[guid]::NewGuid().ToString('N').Substring(0,16)"') do set VERIFY=%%i
if exist captura-leads-config.txt (
  for /f "tokens=1,* delims==" %%a in (captura-leads-config.txt) do (
    if "%%a"=="INTAKE_SECRET" set INTAKESECRET=%%b
    if "%%a"=="META_VERIFY_TOKEN" set VERIFY=%%b
  )
)

set SECRETS=INMOVYA_USER_EMAIL=!EMAIL! INTAKE_SECRET=!INTAKESECRET! META_VERIFY_TOKEN=!VERIFY!
if not "!METATOKEN!"=="" set SECRETS=!SECRETS! META_PAGE_ACCESS_TOKEN=!METATOKEN!
if not "!METASECRET!"=="" set SECRETS=!SECRETS! META_APP_SECRET=!METASECRET!
if not "!BITRIXURL!"=="" set SECRETS=!SECRETS! BITRIX_WEBHOOK_URL=!BITRIXURL!

echo.
echo 3/4 Salvando os segredos no Supabase
call npx -y supabase secrets set !SECRETS! --project-ref %PROJECT%
if errorlevel 1 goto erro

echo.
echo 4/4 Publicando a funcao lead-intake
call npx -y supabase functions deploy lead-intake --no-verify-jwt --project-ref %PROJECT%
if errorlevel 1 goto erro

(
echo INTAKE_SECRET=!INTAKESECRET!
echo META_VERIFY_TOKEN=!VERIFY!
echo URL_META=%URL%
echo URL_BITRIX=%URL%?token=!INTAKESECRET!
echo URL_MAKE=%URL%?token=!INTAKESECRET!
) > captura-leads-config.txt

echo.
echo ==========================================================
echo  PRONTO! Guarde estes dados (salvos em captura-leads-config.txt):
echo.
echo  Meta  - URL de retorno ........ %URL%
echo  Meta  - Token de verificacao .. !VERIFY!
echo  Bitrix - URL do webhook ....... %URL%?token=!INTAKESECRET!
echo  Make/Zapier - URL ............. %URL%?token=!INTAKESECRET!
echo ==========================================================
pause
exit /b 0

:erro_email
echo O e-mail e obrigatorio.
:erro
echo.
echo DEU ERRO - mande um print desta janela para o Claude.
pause
exit /b 1

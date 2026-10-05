@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo === 1/4 Testando o build (se der erro, nada e publicado) ===
call npm run build
if errorlevel 1 goto erro

echo.
echo === 2/4 Salvando as alteracoes (commit) ===
git add src/components/NewLeadNotifier.tsx src/hooks/useNotifications.tsx src/App.tsx src/sw.ts supabase/functions/notify-new-lead/index.ts supabase/notify-new-lead.sql publicar.bat
if errorlevel 1 goto erro
git commit -m "Aviso de lead novo: alerta na tela, som e push no celular" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01842oxAqK7HiWiMDnu7rM1r"
if errorlevel 1 goto erro

echo.
echo === 3/4 Sincronizando com o GitHub ===
git pull --rebase --autostash origin main
if errorlevel 1 goto erro

echo.
echo === 4/4 Enviando para o GitHub (a Vercel publica sozinha) ===
git push origin main
if errorlevel 1 goto erro

echo.
echo ============================================
echo  PUBLICADO! Em 1-2 minutos a Vercel atualiza
echo  https://inmovya-main.vercel.app
echo ============================================
pause
exit /b 0

:erro
echo.
echo ============================================
echo  DEU ERRO - nada foi publicado alem do que
echo  aparece acima. Mande um print para o Claude.
echo ============================================
pause
exit /b 1

@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo === 1/5 Baixando o que ja esta no GitHub ===
git pull --rebase --autostash origin main
if errorlevel 1 goto erro

echo.
echo === 2/5 Testando o build (se der erro, nada e publicado) ===
call npm run build
if errorlevel 1 goto erro

echo.
echo === 3/5 Salvando as alteracoes (commit) ===
git add -A
git diff --cached --quiet
if not errorlevel 1 (
    echo Nenhuma alteracao nova para salvar.
    goto enviar
)
set "MSG="
set /p MSG="Descreva a alteracao (Enter = Atualizacao): "
if "%MSG%"=="" set "MSG=Atualizacao"
git commit -m "%MSG%"
if errorlevel 1 goto erro

:enviar
echo.
echo === 4/5 Enviando para o GitHub ===
git push origin main
if errorlevel 1 goto erro

echo.
echo === 5/5 Pronto - a Vercel publica sozinha ===
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

@echo off
chcp 65001 >nul
echo.
echo  Inmovya - instalando o "ligar automatico" (so para o seu usuario, sem precisar de administrador)
echo.
set "PASTA=%LOCALAPPDATA%\Inmovya"
if not exist "%PASTA%" mkdir "%PASTA%"
copy /Y "%~dp0ligar.ps1" "%PASTA%\ligar.ps1" >nul
reg add "HKCU\Software\Classes\inmovya-ligar" /ve /d "URL:Inmovya Ligar" /f >nul
reg add "HKCU\Software\Classes\inmovya-ligar" /v "URL Protocol" /d "" /f >nul
reg add "HKCU\Software\Classes\inmovya-ligar\shell\open\command" /ve /d "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File \"%PASTA%\ligar.ps1\" \"%%1\"" /f >nul
echo  Pronto! Agora, no Inmovya (Oferta Ativa), ligue a opcao "Apertar Ligar sozinho".
echo  Na primeira ligacao o Chrome pergunta se pode abrir: marque "Sempre permitir" e clique em Abrir.
echo.
pause

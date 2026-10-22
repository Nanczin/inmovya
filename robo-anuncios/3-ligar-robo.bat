@echo off
title Robo de anuncios (NAO FECHE)
cd /d "%~dp0"
if exist "%~dp0node22\node.exe" set "PATH=%~dp0node22;%PATH%"
echo Ligando o robo de anuncios... (deixe esta janela aberta)
:loop
node robo.js
echo O robo parou. Religando em 15 segundos (feche a janela para desligar de vez)...
timeout /t 15 >nul
goto loop

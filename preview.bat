@echo off
cd /d "%~dp0"
echo Iniciando preview do Inmovya em http://localhost:8080 ...
call npm run dev
pause

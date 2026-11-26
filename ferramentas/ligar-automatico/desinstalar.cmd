@echo off
reg delete "HKCU\Software\Classes\inmovya-ligar" /f >nul 2>&1
del /Q "%LOCALAPPDATA%\Inmovya\ligar.ps1" >nul 2>&1
echo  Ligar automatico removido.
pause

@echo off
rem Starts Eluvo on this computer. Double-click this file.
title Eluvo
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 goto nonode
node tools\start.mjs %*
echo.
pause
exit /b

:nonode
echo.
echo Eluvo needs Node.js, which is not installed on this computer.
echo Get the LTS version from https://nodejs.org and install it.
echo Then double-click this file again.
echo.
pause
exit /b 1

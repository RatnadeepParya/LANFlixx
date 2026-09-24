@echo off
title LANFlixx Server
echo ========================================================
echo   🍿 Starting LANFlixx Server
echo ========================================================
cd /d "%~dp0"

:: Idempotent cleanup: Free port 5000 if previously occupied
powershell -NoProfile -Command "$proc = (Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction SilentlyContinue).OwningProcess; if ($proc) { Stop-Process -Id $proc -Force -ErrorAction SilentlyContinue; Write-Host '[INFO] Cleaned up previous instance on port 5000.' }"

npm start
pause

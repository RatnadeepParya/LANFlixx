@echo off
:: Batch script to create an idempotent Windows SMB share for D:\film
echo ========================================================
echo   Setting up Windows Network Share for D:\film
echo ========================================================

powershell -NoProfile -ExecutionPolicy Bypass -Command "if (Get-SmbShare -Name 'film' -ErrorAction SilentlyContinue) { Remove-SmbShare -Name 'film' -Force; Write-Host '[INFO] Existing share refreshed.' }; New-SmbShare -Name 'film' -Path 'D:\film' -ReadAccess 'Everyone' -FullAccess $env:USERNAME; Write-Host '[SUCCESS] D:\film is shared on LAN as \\' + $env:COMPUTERNAME + '\film'"

echo.
echo If you saw an access denied error, right-click and select 'Run as administrator'.
echo.
pause

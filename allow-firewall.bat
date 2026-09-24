@echo off
:: Batch script to allow incoming connections on port 5000 in Windows Firewall
echo ========================================================
echo   Configuring Windows Firewall for LAN Film Streamer
echo ========================================================

:: Idempotent cleanup: delete existing rule first so duplicates are never created
netsh advfirewall firewall delete rule name="LAN Film Streamer (Port 5000)" >nul 2>&1

:: Add fresh firewall rule
netsh advfirewall firewall add rule name="LAN Film Streamer (Port 5000)" dir=in action=allow protocol=TCP localport=5000
echo.
if %errorlevel% equ 0 (
    echo [SUCCESS] Port 5000 is open for your local Wi-Fi / LAN!
) else (
    echo [NOTE] If you saw an access denied error, please right-click this file and select 'Run as administrator'.
)
echo.
pause

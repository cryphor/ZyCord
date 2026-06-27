@echo off
setlocal EnableExtensions
title ZyLord Installer
cd /d "%~dp0"

echo Installing ZyLord Discord Client Mod...
echo.

call npm install --audit=false
if errorlevel 1 (
    echo.
    echo ERROR: npm install failed.
    goto finish
)

echo.
echo Creating start.bat...
(
echo @echo off
echo title ZyLord
echo cd /d "%%~dp0"
echo node index.js start
echo if errorlevel 1 pause
) > start.bat

echo.
echo Installation complete!
echo.
echo Next steps:
echo   1. Run: node index.js up
echo   2. Run: start.bat  (or open Discord normally after patching)
echo.

:finish
echo Press any key to close this window...
pause >nul
endlocal

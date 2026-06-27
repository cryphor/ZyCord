@echo off
setlocal EnableExtensions EnableDelayedExpansion
title ZyCord
cd /d "%~dp0"

echo ZyCord
echo.

echo [%date% %time%] Install started>> zycord.log

where node >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js not found. Install it from https://nodejs.org
    echo [%date% %time%] ERROR: Node.js not found>> zycord.log
    goto finish
)

for /f "delims=" %%i in ('where node') do (
    set "NODE_EXE=%%i"
    goto found_node
)
:found_node
echo Using Node: !NODE_EXE!
echo.

:wait_discord
tasklist /FI "IMAGENAME eq Discord.exe" 2>nul | find /I "Discord.exe" >nul
if not errorlevel 1 (
    echo Discord is still running. Close it completely ^(check system tray^), then press any key to retry...
    pause >nul
    goto wait_discord
)
echo Discord is closed.
echo.

echo Stopping any remaining Discord/Electron processes...
taskkill /F /IM Discord.exe >nul 2>&1
taskkill /F /IM electron.exe >nul 2>&1
timeout /t 2 /nobreak >nul
echo.

echo Cleaning leftover dependencies...
if exist "node_modules\electron" (
    echo Removing old electron folder...
    rmdir /s /q "node_modules\electron" 2>nul
)
if exist "node_modules\@electron" (
    rmdir /s /q "node_modules\@electron" 2>nul
)
if exist "node_modules\electron" (
    echo electron folder is locked — removing all of node_modules...
    rmdir /s /q "node_modules" 2>nul
    del /f "package-lock.json" 2>nul
)

echo.
echo Running npm install...
call npm install --audit=false
set NPM_EXIT=!ERRORLEVEL!
echo npm install exit code: !NPM_EXIT!
if !NPM_EXIT! NEQ 0 (
    echo.
    echo ERROR: npm install failed ^(exit code !NPM_EXIT!^).
    echo Try closing Discord and any Electron apps, then run install.bat again.
    echo [%date% %time%] ERROR: npm install failed with code !NPM_EXIT!>> zycord.log
    goto finish
)

echo.
echo Installing...
call "!NODE_EXE!" index.js up --verbose
set UP_EXIT=!ERRORLEVEL!
echo index.js up exit code: !UP_EXIT!
if !UP_EXIT! NEQ 0 (
    echo.
    echo ERROR: Installation failed ^(exit code !UP_EXIT!^).
    echo [%date% %time%] ERROR: index.js up failed with code !UP_EXIT!>> zycord.log
    goto finish
)

echo.
echo Creating start.bat...
(
echo @echo off
echo title ZyCord
echo cd /d "%%~dp0"
echo echo Starting Discord...
echo "!NODE_EXE!" index.js start --verbose
echo set START_EXIT=%%ERRORLEVEL%%
echo echo start exit code: %%START_EXIT%%
echo if %%START_EXIT%% NEQ 0 (
echo     echo.
echo     echo Failed to start Discord. Check zycord.log for details.
echo     pause
echo ^)
) > start.bat

echo.
echo Done.
echo Log file: %~dp0zycord.log
echo [%date% %time%] Install completed successfully>> zycord.log

:finish
echo.
echo Press any key to close this window...
pause >nul
endlocal

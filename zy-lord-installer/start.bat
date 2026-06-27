@echo off
title ZyCord
cd /d "%~dp0"
echo Starting Discord...
"C:\Program Files\nodejs\node.exe" index.js start --verbose
set START_EXIT=%ERRORLEVEL%
echo start exit code: %START_EXIT%
if %START_EXIT% NEQ 0 (
    echo.
    echo Failed to start Discord. Check zycord.log for details.
    pause
)

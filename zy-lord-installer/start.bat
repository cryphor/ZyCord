@echo off
title ZyLord
cd /d "%~dp0"
node index.js start
if errorlevel 1 pause

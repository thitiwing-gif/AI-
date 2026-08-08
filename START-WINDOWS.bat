@echo off
cd /d "%~dp0"
if not exist .env copy .env.example .env
echo AI Creator Studio V2
cd backend
node server-lite.js
pause

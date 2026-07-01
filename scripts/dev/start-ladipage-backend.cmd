@echo off
cd /d %~dp0..\..
echo Building ladipage-backend...
call bash node_modules/.bin/nx build ladipage-backend --configuration=development
if errorlevel 1 exit /b 1

echo Starting ladipage-backend on port 7002...
set REDIS_HOST=127.0.0.1
set REDIS_PORT=6381
set REDIS_URL=redis://127.0.0.1:6381/0
set LADIPAGE_PORT=7002
set PORT=7002
node --env-file=.env dist\apps\ladipage-backend\main.js
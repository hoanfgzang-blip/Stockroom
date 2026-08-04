@echo off
setlocal

set "PG_BIN=D:\OperationsPostgres\pgsql\bin"
set "PG_DATA=D:\OperationsPostgres\data"
set "PG_LOG=D:\OperationsPostgres\postgres.log"
set "BACKEND_DIR=%~dp0WMS-"
set "FRONTEND_DIR=%~dp0frontend"
set "BACKEND_URL=http://localhost:5295"
set "FRONTEND_URL=http://localhost:5173"

echo ========================================
echo  WMS Local Runner
echo ========================================


if not exist "%BACKEND_DIR%\WMS-.csproj" (
    echo [ERROR] Khong tim thay backend WMS tai: %BACKEND_DIR%
    pause
    exit /b 1
)

if not exist "%FRONTEND_DIR%\package.json" (
    echo [ERROR] Khong tim thay frontend WMS tai: %FRONTEND_DIR%
    pause
    exit /b 1
)



echo [OK] PostgreSQL dang chay tai 127.0.0.1:5432

echo [3/4] Dang bat backend tai %BACKEND_URL%...
start "WMS Backend" cmd /k "cd /d ""%BACKEND_DIR%"" && dotnet run --project WMS-.csproj --urls %BACKEND_URL%"

echo [4/4] Dang bat frontend tai %FRONTEND_URL%...
if not exist "%FRONTEND_DIR%\node_modules" (
    start "WMS Frontend" cmd /k "cd /d ""%FRONTEND_DIR%"" && npm install && npm run dev"
) else (
    start "WMS Frontend" cmd /k "cd /d ""%FRONTEND_DIR%"" && npm run dev"
)

echo.
echo Da bat local. Doi vai giay roi mo:
echo   Frontend: %FRONTEND_URL%
echo   Backend:  %BACKEND_URL%
echo.
echo Tai khoan local: admin / admin123
echo.
pause


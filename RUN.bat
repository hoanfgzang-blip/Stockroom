@echo off
setlocal

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


<<<<<<< HEAD

echo [OK] PostgreSQL dang chay tai 127.0.0.1:5432

echo [3/4] Dang bat backend tai %BACKEND_URL%...
=======
echo [1/2] Dang bat backend tai %BACKEND_URL%...
>>>>>>> 1311656e2bb74f8bcf45d5035b7e91af4a57c35c
start "WMS Backend" cmd /k "cd /d ""%BACKEND_DIR%"" && dotnet run --project WMS-.csproj --urls %BACKEND_URL%"

echo [2/2] Dang bat frontend tai %FRONTEND_URL%...
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
echo.
pause


@echo off
setlocal
title WMS Local Runner

set "BACKEND_DIR=%~dp0WMS-"
set "FRONTEND_DIR=%~dp0frontend"
set "BACKEND_URL=http://localhost:5295"
set "FRONTEND_URL=http://localhost:5173"

echo ========================================
echo  WMS Local Runner
echo ========================================

where dotnet >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Khong tim thay dotnet trong PATH.
    pause
    exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Khong tim thay npm trong PATH.
    pause
    exit /b 1
)

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


echo [1/2] Dang bat backend tai %BACKEND_URL%...
start "WMS Backend" cmd /k "cd /d ""%BACKEND_DIR%"" && dotnet run --project WMS-.csproj --urls %BACKEND_URL%"

timeout /t 2 /nobreak >nul

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


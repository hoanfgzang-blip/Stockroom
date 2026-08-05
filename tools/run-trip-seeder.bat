@echo off
chcp 65001 >nul
echo.
echo ===============================================================
echo   WMS Trip Seeder - Tao Trip va Sack den HUB Ha Noi
echo ===============================================================
echo.
dotnet run --project "%~dp0WmsTripSeeder"
echo.
pause

@echo off
echo Running the application...

cd .\WMS-\
call dotnet run --project WMS-.csproj

cd ..\frontend\
call npm install
call npm run build
pause
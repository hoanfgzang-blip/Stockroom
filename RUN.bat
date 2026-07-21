@echo off
echo Running the application...
cd .\frontend\
call npm install
call npm run build

cd ..\WMS-\
call dotnet run --project WMS-.csproj
call npm run dev
pause
@echo off
echo.
echo  =========================================
echo   G.AI - Iniciando plataforma...
echo  =========================================
echo.

cd /d "%~dp0"

echo [1/2] Iniciando Backend (porta 3001)...
start "G.AI Backend" cmd /k "cd apps\backend && npx tsx src/server.ts"

timeout /t 3 /nobreak >nul

echo [2/2] Iniciando Frontend (porta 3000)...
start "G.AI Frontend" cmd /k "cd apps\web && pnpm dev"

echo.
echo  =========================================
echo   Acesse: http://localhost:3000
echo   Login:  admin@htcore.com.br
echo   Senha:  Admin@2026
echo  =========================================
echo.
pause

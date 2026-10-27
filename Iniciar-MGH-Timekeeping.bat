@echo off
title My Global Hub Timekeeping (API + Web)
echo ============================================================
echo   Iniciando My Global Hub Timekeeping
echo   - Backend API: http://localhost:5050
echo   - Frontend Web: http://localhost:5173
echo ============================================================
echo.

cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js no esta instalado en el sistema o no esta en el PATH.
    echo Por favor instala Node.js LTS desde https://nodejs.org
    echo.
    pause
    exit /b 1
)

echo Verificando dependencias...
if not exist "node_modules\" (
    echo Instalando dependencias de la raiz...
    call npm install
)
if not exist "backend\node_modules\" (
    echo Instalando dependencias del backend...
    cd backend && call npm install && cd ..
)
if not exist "frontend\node_modules\" (
    echo Instalando dependencias del frontend...
    cd frontend && call npm install && cd ..
)

echo.
echo Arrancando servidores Backend y Frontend en paralelo...
echo (Presiona Ctrl + C para detener ambos servidores)
echo.

call npm run dev
pause

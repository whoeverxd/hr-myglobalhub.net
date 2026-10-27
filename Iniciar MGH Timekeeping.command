#!/bin/bash
# Doble clic en Finder para arrancar My Global Hub Timekeeping (API + app web).
cd "$(dirname "$0")" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js no está instalado. Descárgalo (versión LTS) en https://nodejs.org y vuelve a abrir este archivo."
  open "https://nodejs.org/"
  read -r -p "Pulsa Enter para cerrar..."
  exit 1
fi
echo "Node $(node -v)"

[ -d backend/node_modules ]  || (cd backend  && npm install) || { read -r -p "Error instalando backend. Enter para cerrar..."; exit 1; }
[ -d frontend/node_modules ] || (cd frontend && npm install) || { read -r -p "Error instalando frontend. Enter para cerrar..."; exit 1; }

echo "Iniciando API en http://localhost:5050 ..."
(cd backend && npm start) &
API_PID=$!
trap 'kill $API_PID 2>/dev/null' EXIT

(sleep 5 && open "http://localhost:5173") &
echo "Iniciando app web en http://localhost:5173 ... (cierra esta ventana para detener todo)"
cd frontend && npm run dev
read -r -p "La app se detuvo. Pulsa Enter para cerrar..."

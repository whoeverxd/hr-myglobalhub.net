# Instrucciones y Reglas de Desarrollo — MGH Payroll

## 1. REGLA FUNDAMENTAL: PROTECCIÓN DE CUOTAS DE FIREBASE
- **PROHIBIDO TERMINANTEMENTE** ejecutar pruebas automatizadas (`npm test`, `node scripts/run-tests.js`) contra el proyecto de Firebase en producción (`hr-myglobalhub-net`).
- La cuenta está en el **Plan Gratuito (Spark)** con límite de 50k lecturas/día.
- Las pruebas automatizadas deben ejecutarse **100% de manera local** utilizando SQLite (`data/test-run.db`) con `DATABASE_CLIENT=sqlite` y `DISABLE_REMOTE_FIREBASE=true`.
- **Cero llamadas remotas a Firebase durante pruebas.**
- La conexión a Firestore y Firebase Auth es de uso exclusivo para la operación real del servidor con usuarios finales.

## 2. Pila Tecnológica y Arquitectura
- **Backend:** Node.js + Express 5 (`backend/server.js`).
- **Base de Datos en Producción:** Cloud Firestore (`hr-myglobalhub-net`).
- **Base de Datos en Tests:** SQLite local (`backend/data/test-run.db`).
- **Frontend:** React 19 + Vite (`frontend/`).

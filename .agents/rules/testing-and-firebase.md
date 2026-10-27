# Reglas de Entorno y Protección de Firebase

> [!CRITICAL]
> **PROHIBICIÓN ESTRICTA: NUNCA EJECUTAR PRUEBAS O SCRIPTS MASIVOS CONTRA EL PROYECTO DE FIREBASE EN PRODUCCIÓN (`hr-myglobalhub-net`).**

### Contexto y Restricciones
1. **Plan Gratuito (Spark):** El proyecto de Firebase `hr-myglobalhub-net` opera bajo el plan gratuito de Google Cloud / Firebase, el cual tiene límites diarios estrictos:
   - **50,000 lecturas / día**
   - **20,000 escrituras / día**
   - **20,000 eliminaciones / día**
2. **Ambiente de Producción:** Este proyecto es la base de datos oficial y activa de la empresa. Ninguna prueba automatizada, suite de test, ni script de benchmark debe interactuar directamente con la red de Firebase de producción.

---

### Reglas de Ejecución

1. **Pruebas Automatizadas (`npm test`, `node scripts/run-tests.js`):**
   - Las pruebas deben correr **EXCLUSIVAMENTE** contra la base de datos local SQLite (`data/test-run.db`) o con mocks en memoria.
   - La variable `DATABASE_CLIENT` durante los tests debe ser siempre `sqlite`.
   - Queda terminantemente prohibido configurar `DATABASE_CLIENT=firestore` en las suites de pruebas automatizadas.
   - `DISABLE_REMOTE_FIREBASE=true` debe estar activo en todos los entornos de prueba.

2. **Uso Exclusivo de Firebase:**
   - La conexión a Cloud Firestore y Firebase Auth está reservada **ÚNICA Y EXCLUSIVAMENTE para la aplicación en vivo** (servidor backend en tiempo de ejecución para usuarios y colaboradores reales).

3. **Verificación de Migraciones o Scripts:**
   - Si se requiere crear o modificar scripts que interactúen con Firebase, el agente **NUNCA** debe ejecutarlos automáticamente sin autorización expresa del usuario.

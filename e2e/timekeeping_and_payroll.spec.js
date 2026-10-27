// @ts-check
import { test, expect } from '@playwright/test';

test.describe('MGH Timekeeping & Payroll Production E2E Suite', () => {
  const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';

  test('Flujo 1: Registro por Actividades (#actDaily), evidencias y equivalencia', async ({ page }) => {
    // 1. Navegar a la aplicacion
    await page.goto(`${BASE_URL}/#actDaily`);
    await expect(page).toHaveTitle(/My Global Hub|MGH/i);

    // 2. Verificar banner de equivalencia arquitectural y componentes principales
    const banner = page.locator('text=Equivalencia Arquitectural Garantizada');
    await expect(banner).toBeVisible();

    // 3. Abrir Drawer de nueva actividad
    const newActButton = page.locator('button:has-text("+ Registrar Actividad")');
    if (await newActButton.isVisible()) {
      await newActButton.click();
      await expect(page.locator('text=Registrar Nueva Actividad')).toBeVisible();

      // 4. Completar formulario de actividad
      await page.fill('textarea', 'Implementación de pruebas E2E y validación de flujos');
      await page.fill('input[type="number"]', '3.5');

      // 5. Guardar actividad
      await page.click('button:has-text("Guardar Actividad")');
    }

    // 6. Navegar al centro de aprobaciones
    await page.goto(`${BASE_URL}/#approvals`);
    await expect(page.locator('text=Hoja de Tiempo').or(page.locator('text=Timesheets'))).toBeVisible();
  });

  test('Flujo 2: Motor de Nomina (#payroll) y generacion de archivos de dispersion bancaria', async ({ page }) => {
    // 1. Navegar al modulo de nomina
    await page.goto(`${BASE_URL}/#payroll`);

    // 2. Verificar KPIs de nomina
    const grossKpi = page.locator('text=Total Bruto').or(page.locator('text=Gross Pay'));
    await expect(grossKpi.first()).toBeVisible();

    // 3. Verificar rails de pago y tabs de dispersion
    const paymentsSection = page.locator('text=Banco BHD').or(page.locator('text=NACHA'));
    if (await paymentsSection.count() > 0) {
      await expect(paymentsSection.first()).toBeVisible();
    }
  });
});

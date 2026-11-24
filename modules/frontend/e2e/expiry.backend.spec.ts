import { expect, test, type Browser, type Page } from "@playwright/test";
import { uniqueRecordNumber } from "./support/recordNumber";

/**
 * Vencimiento de cuentas contra el backend real (tarea 4.5 de add-account-expiry): un ADMIN deja
 * vencida la cuenta de un tratante desde "Usuarios"; el tratante pasa a solo lectura (aviso,
 * sin "Nueva historia", historia sin edición, vista previa activa); el ADMIN la renueva y el
 * tratante recupera la edición sin iniciar sesión de nuevo.
 * Necesita backend + PostgreSQL y una cuenta ADMIN existente:
 * `E2E_BACKEND=1 E2E_ADMIN_EMAIL=… E2E_ADMIN_PASSWORD=… pnpm test:e2e`.
 */
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD;
test.skip(!process.env.E2E_BACKEND || !ADMIN_EMAIL || !ADMIN_PASSWORD, "Necesita backend, PostgreSQL y E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD");

const PASSWORD = "password123";
const EXPIRED_NOTICE = /Tu acceso venció el 01\/01\/2020\./;

async function registerTratante(browser: Browser, fullName: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  const email = `e2e-vence-${Date.now()}-${Math.floor(Math.random() * 1e6)}@empresa.test`;
  await page.goto("/registro");
  await page.getByLabel("Nombre completo").fill(fullName);
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByRole("textbox", { name: "Contraseña", exact: true }).fill(PASSWORD);
  await page.getByRole("textbox", { name: "Confirmar contraseña" }).fill(PASSWORD);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page).not.toHaveURL(/\/(ingresar|registro)/);
  return page;
}

async function loginAdmin(browser: Browser): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/ingresar");
  await page.getByLabel(/correo/i).fill(ADMIN_EMAIL!);
  await page.getByLabel(/^contraseña$/i).fill(ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).not.toHaveURL(/\/(ingresar|registro)/);
  return page;
}

/** El listado ordena por id: la cuenta recién creada está en la última página. */
async function userRow(page: Page, fullName: string) {
  await page.goto("/usuarios");
  await expect(page.getByRole("heading", { name: "Usuarios" })).toBeVisible();
  const next = page.getByRole("button", { name: "Siguiente" });
  while (await next.isEnabled()) {
    const label = await page.getByText(/^Página \d+ de \d+$/).textContent();
    await next.click();
    await expect(page.getByText(/^Página \d+ de \d+$/)).not.toHaveText(label ?? "");
  }
  return page.getByRole("row", { name: new RegExp(fullName) });
}

test("una cuenta vencida solo lee e imprime hasta que el ADMIN la renueva", async ({ browser }) => {
  const fullName = `Dra. Vence ${Date.now()}`;
  const tratante = await registerTratante(browser, fullName);

  // Antes de vencer: crea su historia y no ve ningún aviso de vencimiento.
  await tratante.goto("/historias");
  await tratante.getByRole("link", { name: /Nueva historia/ }).first().click();
  await tratante.getByRole("textbox", { name: "Nro. de historia" }).fill(uniqueRecordNumber());
  await tratante.getByRole("textbox", { name: "Alias del paciente" }).fill("Vence");
  await tratante.getByRole("button", { name: /Crear historia/ }).click();
  await expect(tratante).toHaveURL(/\/historias\/\d+\?paso=2$/);
  await expect(tratante.getByText(/Tu acceso venció/)).toHaveCount(0);

  // ADMIN: fija una fecha pasada desde "Cambiar fecha".
  const admin = await loginAdmin(browser);
  let row = await userRow(admin, fullName);
  await row.getByRole("button", { name: `Cambiar la fecha de vencimiento de ${fullName}` }).click();
  const dialog = admin.getByRole("dialog");
  await dialog.getByLabel("Último día de acceso").fill("2020-01-01");
  await dialog.getByRole("button", { name: "Guardar" }).click();
  await expect(row).toContainText("Vencida");
  await expect(row.getByRole("button", { name: `Renovar el acceso de ${fullName}` })).toBeVisible();

  // Tratante: al recargar (nueva lectura de la sesión) ve el aviso y solo lectura.
  await tratante.goto("/historias");
  await expect(tratante.getByText(EXPIRED_NOTICE)).toBeVisible();
  await expect(tratante.getByRole("link", { name: /Nueva historia/ })).toHaveCount(0);

  // La historia se abre en lectura y la vista previa de impresión sigue activa.
  await tratante.getByRole("link", { name: /Editar historia/ }).first().click();
  await expect(tratante.getByText(EXPIRED_NOTICE)).toBeVisible();
  await expect(tratante.getByRole("textbox", { name: "Alias del paciente" })).toBeDisabled();
  await expect(tratante.getByRole("button", { name: "Guardar" })).toBeDisabled();
  await expect(tratante.getByRole("link", { name: /Vista previa de impresión/ })).toBeVisible();

  // ADMIN: renueva desde la fila (con confirmación) y ve la nueva fecha sin recargar.
  row = await userRow(admin, fullName);
  await row.getByRole("button", { name: `Renovar el acceso de ${fullName}` }).click();
  await admin.getByRole("alertdialog").getByRole("button", { name: "Renovar" }).click();
  await expect(row).toContainText("Vence el");
  await expect(row).not.toContainText("Vencida");

  // Tratante: la renovación rige sin nuevo inicio de sesión.
  await tratante.goto("/historias");
  await expect(tratante.getByText(/Tu acceso venció/)).toHaveCount(0);
  await expect(tratante.getByRole("link", { name: /Nueva historia/ }).first()).toBeVisible();
});

import { readFileSync } from "node:fs";
import { expect, test, type BrowserContext, type Page, type Request } from "@playwright/test";

/**
 * Smoke sin backend (corre en CI): la libreta local de punta a punta entre dos contextos del navegador
 * (la PC y el celular). En el primero se guarda en la libreta, se exporta el archivo cifrado; en el segundo
 * se importa, se busca por nombre y se imprime. Con fixtures que incluyen fragmentos del paciente
 * (apellido, últimos 4 dígitos del documento, fragmento del domicilio y el nombre sin tildes) se comprueba
 * que NADA de eso viaja en la dirección, las cabeceras o el cuerpo de ninguna petición, ni aparece en el
 * título del documento ni en el nombre del archivo (capacidad patient-notebook).
 */
const FRAGMENTS = ["Quispe", "quispe", "Mamani", "Lucía", "Lucia", "74125896", "5896", "Sol 123", "Cercado"];

const content = {
  schemaVersion: 12,
  anamnesis: {},
  facial: {},
  functional: { suckingHabitTypes: ["NONE"] },
  occlusal: {},
  models: {},
  radiographic: {},
  diagnosis: { problemList: [], treatmentGoals: [] },
  signatures: {},
};
const record = {
  id: 10,
  recordNumber: "AEO-0001",
  authorId: 1,
  authorName: "Dra. María Torres",
  treatingDentist: "Dra. María Torres",
  patientAlias: "Ana L",
  patientSex: "FEMALE",
  patientAge: 13,
  treatmentStartDate: null,
  content,
  lastStep: 1,
  filledSteps: [1],
  patientLockedAt: null,
  version: 0,
  createdAt: "2026-10-01T10:00:00Z",
  updatedAt: "2026-10-01T10:00:00Z",
};
const summary = {
  id: 10,
  recordNumber: "AEO-0001",
  patientAlias: "Ana L",
  treatingDentist: "Dra. María Torres",
  authorName: "Dra. María Torres",
  updatedAt: "2026-10-01T10:00:00Z",
  patientLocked: false,
};
const pageOf = (rows: unknown[]) => ({ content: rows, page: 0, size: 10, totalElements: rows.length, totalPages: 1, last: true });
const json = (body: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });

/** Todo lo que sale de un contexto: dirección, cabeceras y cuerpo de cada petición. */
function recordTraffic(context: BrowserContext): string[] {
  const traffic: string[] = [];
  context.on("request", (request: Request) => {
    traffic.push(`${request.method()} ${request.url()}\n${JSON.stringify(request.headers())}\n${request.postData() ?? ""}`);
  });
  return traffic;
}

/** ¿Alguna petición lleva algún fragmento? Devuelve las coincidencias (vacío = limpio). */
function leaks(traffic: string[], fragments = FRAGMENTS): string[] {
  return traffic.flatMap((entry) => fragments.filter((fragment) => entry.includes(fragment)).map((fragment) => `${fragment} en «${entry.split("\n")[0]}»`));
}

async function mockApi(context: BrowserContext, onSearch?: (body: string) => void, onPrint?: (body: string) => void) {
  await context.route("**/auth/refresh", (route) =>
    route.fulfill(json({ accessToken: "token-e2e", user: { id: 1, email: "e2e@empresa.test", role: "USER", fullName: "Dra. María Torres" } })),
  );
  await context.route("**/api/orthodontic-records/quota", (route) => route.fulfill(json({ limit: null, used: 1, reached: false })));
  await context.route("**/api/orthodontic-records/10/legacy-identity", (route) => route.fulfill({ status: 404, contentType: "application/problem+json", body: "{}" }));
  await context.route("**/api/orthodontic-records/10/print", (route) => {
    onPrint?.(route.request().postData() ?? "");
    return route.fulfill(json({ record: { ...record, patientLockedAt: "2026-10-05T15:00:00Z" }, printedOn: "2026-10-05", clinicalFilledSteps: 1 }));
  });
  await context.route("**/api/orthodontic-records/search**", (route) => {
    onSearch?.(route.request().postData() ?? "");
    return route.fulfill(json(pageOf([summary])));
  });
  await context.route(/\/api\/orthodontic-records\/10(\?.*)?$/, (route) => route.fulfill(json(record)));
  await context.route(/\/api\/orthodontic-records(\?.*)?$/, (route) => route.fulfill(json(pageOf([summary]))));
}

async function withStubbedPrint(page: Page) {
  await page.addInitScript(() => {
    window.print = () => undefined;
  });
}

test("el detector de fugas falla si se introduce un fragmento en una URL", () => {
  expect(leaks(["GET https://app.test/api/orthodontic-records?q=Quispe\n{}\n"])).toEqual(["Quispe en «GET https://app.test/api/orthodontic-records?q=Quispe»"]);
  expect(leaks(["POST https://app.test/api/orthodontic-records/search\n{}\n{\"recordIds\":[10]}"])).toEqual([]);
});

test("guardar, exportar en un contexto e importar, buscar e imprimir en otro, sin que viaje nada de la libreta", async ({ browser }, testInfo) => {
  // --- La PC: guarda en la libreta y exporta ---
  const pc = await browser.newContext();
  const pcTraffic = recordTraffic(pc);
  await mockApi(pc);
  const pcPage = await pc.newPage();
  await pcPage.goto("/historias/10?paso=1");

  const notebook = pcPage.getByRole("region", { name: "Solo en este dispositivo" });
  await notebook.getByLabel("Nombre y apellidos").fill("Ana Lucía Quispe Mamani");
  await notebook.getByRole("radio", { name: "DNI" }).check();
  await notebook.getByLabel("Número").fill("74125896");
  await notebook.getByLabel("Domicilio").fill("Av. Sol 123, Cercado");
  await expect(notebook.getByText(/Guardado en este dispositivo/)).toBeVisible({ timeout: 10_000 });

  await pcPage.goto("/libreta");
  await pcPage.getByRole("button", { name: "Exportar libreta" }).click();
  const phrase = (await pcPage.getByLabel("Frase de exportación").textContent())!.trim();
  expect(phrase.split(" ")).toHaveLength(6);
  await pcPage.getByRole("checkbox", { name: "Guardé la frase en un lugar seguro" }).check();
  const [download] = await Promise.all([pcPage.waitForEvent("download"), pcPage.getByRole("button", { name: "Descargar archivo" }).click()]);
  expect(download.suggestedFilename()).toMatch(/^libreta-\d{8}\.hsflibreta$/);
  for (const fragment of FRAGMENTS) expect(download.suggestedFilename()).not.toContain(fragment);
  const file = testInfo.outputPath("libreta.hsflibreta");
  await download.saveAs(file);
  const fileText = readFileSync(file, "utf8");
  for (const fragment of FRAGMENTS) expect(fileText).not.toContain(fragment);   // ilegible sin la frase

  // --- El celular: otro contexto (otra libreta) importa, busca e imprime ---
  const phone = await browser.newContext();
  const phoneTraffic = recordTraffic(phone);
  const searches: string[] = [];
  const prints: string[] = [];
  await mockApi(phone, (body) => searches.push(body), (body) => prints.push(body));
  const phonePage = await phone.newPage();
  await withStubbedPrint(phonePage);
  await phonePage.goto("/libreta");
  await phonePage.getByLabel(/Archivo de la libreta/).setInputFiles(file);
  await phonePage.getByLabel("Frase").fill(phrase);
  await phonePage.getByRole("button", { name: "Importar" }).click();
  await expect(phonePage.getByText(/Libreta importada: 1 agregadas/)).toBeVisible({ timeout: 15_000 });

  await phonePage.goto("/historias");
  await expect(phonePage.getByRole("row", { name: /AEO-0001/ })).toBeVisible();
  await phonePage.getByRole("searchbox", { name: "Buscar historias" }).fill("quispe");
  await expect.poll(() => searches.length).toBeGreaterThan(0);
  expect(searches[0]).toBe('{"recordIds":[10]}');                                  // identificadores, no el texto
  expect(new URL(phonePage.url()).search).toBe("");

  await phonePage.goto("/historias/10/imprimir");
  const sheet = phonePage.getByRole("article").first();
  await expect(sheet.getByText("Ana Lucía Quispe Mamani")).toBeVisible();          // el navegador une la libreta al imprimir
  await expect(sheet.getByText("DNI 74125896")).toBeVisible();
  expect(await phonePage.title()).toBe("Historia clínica de ortodoncia");
  await phonePage.getByRole("button", { name: "Imprimir" }).click();
  await expect.poll(() => prints.length).toBe(1);
  expect(JSON.parse(prints[0])).toEqual({ filledSteps: [1] });

  // --- Nada de la libreta salió de ningún navegador ---
  expect(leaks(pcTraffic)).toEqual([]);
  expect(leaks(phoneTraffic)).toEqual([]);
  await pc.close();
  await phone.close();
});

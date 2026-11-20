import { expect, test } from "@playwright/test";

/**
 * Smoke sin backend (corre en CI): crear una historia con alias, sexo y edad, imprimirla y
 * reimprimirla, y comprobar en la red que ninguna petición lleva los campos retirados del paciente
 * (documento, nacimiento, lugar, domicilio, celular ni nombres de firma) ni el alias en una URL
 * (capacidad orthodontic-records, change update-orthodontic-records-pseudonymous-patient).
 */
const RETIRED = ["documentType", "documentNumber", "birthDate", "birthPlace", "address", "phone", "patientSignatureName", "guardianName", "guardianRelationship"];

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
const record = (patientLockedAt: string | null) => ({
  id: 10,
  recordNumber: "AEO-0015",
  authorId: 1,
  authorName: "Dra. María Torres",
  treatingDentist: "Dra. María Torres",
  patientAlias: "Mateo",
  patientSex: "MALE",
  patientAge: 13,
  treatmentStartDate: null,
  content,
  lastStep: 1,
  filledSteps: [1],
  patientLockedAt,
  version: 0,
  createdAt: "2026-10-01T10:00:00Z",
  updatedAt: "2026-10-01T10:00:00Z",
});
const json = (body: unknown, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });

test("crear, imprimir y reimprimir con alias no envía datos retirados", async ({ page }) => {
  const urls: string[] = [];
  const bodies: string[] = [];
  let created: Record<string, unknown> | null = null;
  let locked: string | null = null;
  page.on("request", (request) => {
    urls.push(request.url());
    if (request.method() !== "GET") bodies.push(request.postData() ?? "");
  });
  await page.addInitScript(() => {
    window.print = () => undefined;
  });

  await page.route("**/auth/refresh", (route) =>
    route.fulfill(json({ accessToken: "token-e2e", user: { id: 1, email: "e2e@empresa.test", role: "USER", fullName: "Dra. María Torres" } })),
  );
  await page.route("**/api/orthodontic-records/quota", (route) => route.fulfill(json({ limit: null, used: 0, reached: false })));
  await page.route("**/api/orthodontic-records/10/print", (route) => {
    locked ??= "2026-10-05T15:00:00Z";
    return route.fulfill(json({ record: record(locked), printedOn: "2026-10-05", clinicalFilledSteps: 1 }));
  });
  await page.route(/\/api\/orthodontic-records\/10(\?.*)?$/, (route) => route.fulfill(json(record(locked))));
  await page.route(/\/api\/orthodontic-records$/, (route) => {
    if (route.request().method() === "POST") {
      created = JSON.parse(route.request().postData() ?? "{}");
      return route.fulfill(json(record(null), 201));
    }
    return route.fulfill(json({ content: [], page: 0, size: 10, totalElements: 0, totalPages: 1, last: true }));
  });

  await page.goto("/historias/nueva");
  await page.getByRole("textbox", { name: "Nro. de historia" }).fill("AEO-0015");
  await page.getByRole("textbox", { name: "Alias del paciente" }).fill("Mateo");
  await page.getByRole("radio", { name: "Masculino" }).check();
  await page.getByLabel("Edad al inicio del tratamiento").fill("13");
  await page.getByRole("button", { name: /Crear historia/ }).click();
  await expect(page).toHaveURL(/\/historias\/10\?paso=2$/);

  expect(created).toMatchObject({ recordNumber: "AEO-0015", patientAlias: "Mateo", patientSex: "MALE", patientAge: 13 });

  // Imprimir y reimprimir: la primera fija alias, sexo y edad; la segunda no cambia nada.
  await page.goto("/historias/10/imprimir");
  await page.getByRole("button", { name: "Imprimir" }).click();
  await expect.poll(() => locked).not.toBeNull();
  await page.getByRole("button", { name: "Imprimir" }).click();

  expect(bodies.join("\n")).not.toMatch(new RegExp(RETIRED.join("|")));
  expect(urls.filter((url) => url.includes("Mateo"))).toEqual([]);
});

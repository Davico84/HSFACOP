import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/mocks/server";
import type { RecordResponse } from "@/modules/core/services/generated/model";
import { recordResponse } from "../test/fixtures";
import { renderRecordRoutes } from "../test/renderRecordRoutes";
import { getEntry, listEntries } from "../notebook/notebookDb";
import * as notebookFile from "../notebook/notebookFile";

const LEGACY = {
  patientName: "Ana Lucía Quispe Mamani",
  documentType: "DNI",
  documentNumber: "74125896",
  birthDate: "2012-05-20",
  birthPlace: "Arequipa",
  address: "Av. Sol 123",
  phone: "987654321",
  guardianName: "Rosa Mamani",
  guardianRelationship: "Madre",
};

interface Backend {
  legacyCalls: number;
  backups: number;
  puts: string[];
  /** Cómo responde cada operación (para simular fecha vencida, otro autor o fallos de red). */
  legacy: "ok" | "closed";
  backup: "ok" | "closed" | "network";
  /** Fecha límite que devuelve el servidor junto a los datos (ISO), si la hay. */
  deadline: string | null;
}

function mockBackend(initial: Partial<Backend> = {}, record: Partial<RecordResponse> = {}) {
  const state: Backend = { legacyCalls: 0, backups: 0, puts: [], legacy: "ok", backup: "ok", deadline: null, ...initial };
  server.use(
    http.get("*/api/orthodontic-records/:id", () => HttpResponse.json(recordResponse(record))),
    http.get("*/api/orthodontic-records/:id/legacy-identity", () => {
      state.legacyCalls += 1;
      return state.legacy === "ok"
        ? HttpResponse.json({ ...LEGACY, ...(state.deadline ? { copyDeadline: state.deadline } : {}) }, { headers: { "Cache-Control": "no-store" } })
        : HttpResponse.json({ type: "/errors/record-not-found", detail: "No se encontró la historia clínica." }, { status: 404 });
    }),
    http.post("*/api/orthodontic-records/:id/notebook-backup", async ({ request }) => {
      state.backups += 1;
      state.puts.push(await request.text());
      if (state.backup === "network") return HttpResponse.error();
      return state.backup === "ok"
        ? new HttpResponse(null, { status: 204 })
        : HttpResponse.json({ type: "/errors/record-not-found", detail: "No se encontró la historia clínica." }, { status: 404 });
    }),
  );
  return state;
}

const stepHeading = (title: RegExp) => screen.findByRole("heading", { level: 2, name: title });
const copyRegion = () => screen.findByRole("region", { name: "Pasar a mi libreta" });

let downloads: string[];
beforeEach(() => {
  downloads = [];
  vi.spyOn(URL, "createObjectURL").mockImplementation(() => "blob:test");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    downloads.push(this.download);
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

async function openRecord() {
  renderRecordRoutes("/historias/10?paso=1");
  await stepHeading(/Paciente y anamnesis/);
}

async function copyAndExport(user = userEvent.setup()) {
  const region = await copyRegion();
  await user.click(within(region).getByRole("button", { name: "Pasar a mi libreta" }));
  await within(region).findByLabelText("Frase de exportación", undefined, { timeout: 10000 });
  await user.click(within(region).getByRole("checkbox", { name: "Guardé la frase en un lugar seguro" }));
  return { region, user };
}

describe("patient-notebook — copia de las historias existentes", () => {
  it("Copiar, exportar y verificar: queda en la libreta, en un archivo y marcada como respaldada, sin enviar datos", async () => {
    const backend = mockBackend();
    await openRecord();
    const { region, user } = await copyAndExport();

    // Copiado a la libreta: el formulario de la sección muestra los datos.
    expect(await getEntry(1, 10)).toMatchObject({ fullName: LEGACY.patientName, documentNumber: "74125896", address: "Av. Sol 123", signerName: "Rosa Mamani", signerRelationship: "Madre" });
    const notebook = screen.getByRole("region", { name: "Solo en este dispositivo" });
    expect(within(notebook).getByLabelText("Nombre y apellidos")).toHaveValue(LEGACY.patientName);

    await user.click(within(region).getByRole("button", { name: "Descargar y verificar" }));

    expect(await within(region).findByText(/quedó marcada como respaldada/, undefined, { timeout: 10000 })).toBeInTheDocument();
    expect(downloads[0]).toMatch(/^libreta-\d{8}\.hsflibreta$/);
    expect(backend.backups).toBe(1);
    // El servidor solo recibe la marca: ningún dato del paciente.
    expect(backend.puts.join("")).toBe("");
    expect((await listEntries(1))[0].exportedAt).not.toBeNull();
  }, 30000);

  it("Copia sin respaldo: si la verificación del archivo falla, no se marca y se ofrece reintentar", async () => {
    const backend = mockBackend();
    await openRecord();
    const { region, user } = await copyAndExport();
    vi.spyOn(notebookFile, "decodeNotebook").mockRejectedValue(new notebookFile.ImportError());

    await user.click(within(region).getByRole("button", { name: "Descargar y verificar" }));

    expect(await within(region).findByText(/No se pudo verificar el archivo exportado/)).toBeInTheDocument();
    expect(backend.backups).toBe(0);
    expect(within(region).getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  }, 30000);

  it("Copia sin respaldo: si el archivo descifra a algo distinto de lo copiado, no se marca", async () => {
    const backend = mockBackend();
    await openRecord();
    const { region, user } = await copyAndExport();
    const real = await getEntry(1, 10);
    vi.spyOn(notebookFile, "decodeNotebook").mockResolvedValue({ entries: [{ ...real!, fullName: "Otro nombre" }], foreign: 0 });

    await user.click(within(region).getByRole("button", { name: "Descargar y verificar" }));

    expect(await within(region).findByText(/No se pudo verificar el archivo exportado/)).toBeInTheDocument();
    expect(backend.backups).toBe(0);
  }, 30000);

  it("fallo de red al marcar: la libreta y el archivo siguen bien, se reintenta y la marca es idempotente", async () => {
    const backend = mockBackend({ backup: "network" });
    await openRecord();
    const { region, user } = await copyAndExport();

    await user.click(within(region).getByRole("button", { name: "Descargar y verificar" }));
    expect(await within(region).findByText(/No se pudo registrar el respaldo/, undefined, { timeout: 10000 })).toBeInTheDocument();
    expect(await getEntry(1, 10)).not.toBeNull();   // nada se pierde

    backend.backup = "ok";
    await user.click(within(region).getByRole("button", { name: "Reintentar" }));
    expect(await within(region).findByText(/quedó marcada como respaldada/)).toBeInTheDocument();
    expect(backend.backups).toBe(2);
  }, 30000);

  it("Cambio de autor durante la copia: se cancela, no guarda nada en la libreta y la marca no se pone", async () => {
    // Al abrir la historia la copia estaba disponible; al copiar, el servidor ya responde 404.
    const backend = mockBackend();
    await openRecord();
    const region = await copyRegion();
    backend.legacy = "closed";

    await userEvent.setup().click(within(region).getByRole("button", { name: "Pasar a mi libreta" }));

    expect(await within(region).findByText(/La copia ya no está disponible/)).toBeInTheDocument();
    expect(await getEntry(1, 10)).toBeNull();
    expect(backend.backups).toBe(0);
  });

  const inDays = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000 - 60_000).toISOString();

  it("El aviso muestra la fecha límite y los días que quedan", async () => {
    mockBackend({ deadline: inDays(10) });
    await openRecord();
    const region = await screen.findByRole("region", { name: "Pasar a mi libreta" });
    const line = within(region).getByText(/Fecha límite: \d{2}\/\d{2}\/\d{4} \(quedan 10 días\)/);
    expect(line.className).not.toMatch(/bg-warning/);
  });

  it("Con 3 días o menos para la fecha límite, el aviso se destaca", async () => {
    mockBackend({ deadline: inDays(2) });
    await openRecord();
    const region = await screen.findByRole("region", { name: "Pasar a mi libreta" });
    expect(within(region).getByText(/\(quedan 2 días\)/).className).toMatch(/bg-warning/);
  });

  it("Fecha límite vencida o historia ya migrada: la copia no está disponible y la historia sigue funcionando", async () => {
    mockBackend({ legacy: "closed" });
    await openRecord();
    await screen.findByRole("region", { name: "Solo en este dispositivo" });

    expect(screen.queryByRole("region", { name: "Pasar a mi libreta" })).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Alias del paciente" })).toBeInTheDocument();
  });

  it("la copia no pisa lo que el autor ya escribió en su libreta", async () => {
    mockBackend();
    await openRecord();
    const notebook = await screen.findByRole("region", { name: "Solo en este dispositivo" });
    const user = userEvent.setup();
    await user.type(within(notebook).getByLabelText("Domicilio"), "Mi domicilio nuevo");
    await waitFor(async () => expect((await getEntry(1, 10))?.address).toBe("Mi domicilio nuevo"), { timeout: 3000 });

    const { region } = await copyAndExport(user);

    const entry = await getEntry(1, 10);
    expect(entry?.address).toBe("Mi domicilio nuevo");        // lo escrito se conserva
    expect(entry?.fullName).toBe(LEGACY.patientName);         // lo vacío se llena con lo antiguo
    expect(region).toBeInTheDocument();
  }, 30000);

  it("sin IndexedDB o sin criptografía no se ofrece la copia (no habría dónde guardar ni cómo exportar)", async () => {
    vi.stubGlobal("indexedDB", undefined);
    const backend = mockBackend();
    await openRecord();
    await screen.findByRole("region", { name: "Solo en este dispositivo" });

    expect(screen.queryByRole("region", { name: "Pasar a mi libreta" })).not.toBeInTheDocument();
    expect(backend.legacyCalls).toBe(0);
    vi.unstubAllGlobals();
  });
});

import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/mocks/server";
import type { RecordSummaryResponse } from "@/modules/core/services/generated/model";
import { summary } from "../test/fixtures";
import { renderRecordRoutes } from "../test/renderRecordRoutes";
import { putEntry } from "../notebook/notebookDb";
import { EMPTY_NOTEBOOK_FIELDS, notebookEntrySchema, type NotebookEntry } from "../notebook/notebookSchema";

function entry(recordId: number, overrides: Partial<NotebookEntry> = {}): NotebookEntry {
  return notebookEntrySchema.parse({
    ...EMPTY_NOTEBOOK_FIELDS,
    accountId: 1,
    recordId,
    recordNumber: `AEO-${String(recordId).padStart(4, "0")}`,
    revision: 1,
    updatedAt: "2026-10-04T10:00:00Z",
    exportedAt: null,
    schemaVersion: 1,
    ...overrides,
  });
}

const page = (content: RecordSummaryResponse[]) => ({ content, page: 0, size: 10, totalElements: content.length, totalPages: 1, last: true });

/** El listado y la búsqueda; guarda cada petición (URL y cuerpo) para comprobar qué viaja. */
function mockBackend() {
  const traffic: { url: string; body: string }[] = [];
  const searches: { recordIds?: number[]; q?: string }[] = [];
  server.use(
    http.get("*/api/orthodontic-records", ({ request }) => {
      traffic.push({ url: request.url, body: "" });
      return HttpResponse.json(page([summary({ id: 1, recordNumber: "AEO-0001", patientAlias: "Otra" })]));
    }),
    http.post("*/api/orthodontic-records/search", async ({ request }) => {
      const body = await request.text();
      traffic.push({ url: request.url, body });
      const parsed = JSON.parse(body) as { recordIds?: number[]; q?: string };
      searches.push(parsed);
      const rows = (parsed.recordIds ?? [15]).slice(0, 10).map((id) => summary({ id, recordNumber: `AEO-${String(id).padStart(4, "0")}`, patientAlias: "Ana" }));
      return HttpResponse.json(page(rows), { headers: { "Cache-Control": "no-store" } });
    }),
  );
  return { traffic, searches };
}

const searchBox = () => screen.getByRole("searchbox", { name: "Buscar historias" });

describe("patient-notebook — búsqueda local por nombre o documento", () => {
  it("Buscar por nombre: el listado muestra la historia y ninguna petición contiene el texto", async () => {
    await putEntry(entry(15, { fullName: "Ana QUÍSPE Rojas" }));
    const { traffic, searches } = mockBackend();
    renderRecordRoutes("/historias");
    await screen.findByRole("row", { name: /AEO-0001/ });

    await userEvent.setup().type(searchBox(), "quispe");

    expect(await screen.findByRole("row", { name: /AEO-0015/ })).toBeInTheDocument();
    // La petición lleva identificadores en el cuerpo (POST), sin el texto y sin nada en la dirección.
    expect(searches).toEqual([{ recordIds: [15] }]);
    expect(traffic.every((t) => !/quispe/i.test(t.url + t.body))).toBe(true);
    expect(traffic.filter((t) => t.body.includes("recordIds")).every((t) => new URL(t.url).search.includes("recordIds") === false)).toBe(true);
  });

  it("por documento, sin distinguir mayúsculas ni tildes", async () => {
    await putEntry(entry(15, { fullName: "José Peña", documentType: "DNI", documentNumber: "74125896" }));
    const { searches } = mockBackend();
    renderRecordRoutes("/historias");
    await screen.findByRole("row", { name: /AEO-0001/ });
    const user = userEvent.setup();

    await user.type(searchBox(), "JOSE PENA");
    await screen.findByRole("row", { name: /AEO-0015/ });
    await user.clear(searchBox());
    await user.type(searchBox(), "74125896");
    await waitFor(() => expect(searches.length).toBeGreaterThanOrEqual(2));
    expect(searches.at(-1)).toEqual({ recordIds: [15] });
  });

  it("Sin coincidencias o sin libreta: un nombre completo no sale del navegador y se avisa 'en este dispositivo'", async () => {
    const { traffic, searches } = mockBackend();
    renderRecordRoutes("/historias");
    await screen.findByRole("row", { name: /AEO-0001/ });

    await userEvent.setup().type(searchBox(), "Ana Lucía Quispe Rojas");

    expect(await screen.findByText("No hay historias que coincidan en este dispositivo.")).toBeInTheDocument();
    expect(searches).toEqual([]);
    expect(traffic.every((t) => !/quispe|luc/i.test(t.url + t.body))).toBe(true);
  });

  it("un texto con forma de alias o de número, sin coincidencia local, se busca en el servidor como siempre", async () => {
    const { searches } = mockBackend();
    renderRecordRoutes("/historias");
    await screen.findByRole("row", { name: /AEO-0001/ });

    await userEvent.setup().type(searchBox(), "mateo");

    await waitFor(() => expect(searches).toEqual([{ q: "mateo" }]));
  });

  it("Más de 50 coincidencias: se piden las 50 más recientes y se pide afinar la búsqueda", async () => {
    for (let id = 1; id <= 60; id += 1) {
      await putEntry(entry(id, { fullName: "Quispe Lote", updatedAt: new Date(Date.UTC(2026, 9, 1, 0, id)).toISOString() }));
    }
    const { searches } = mockBackend();
    renderRecordRoutes("/historias");
    await screen.findByRole("row", { name: /AEO-0001/ });

    await userEvent.setup().type(searchBox(), "quispe");

    await waitFor(() => expect(searches[0]?.recordIds).toHaveLength(50));
    expect(searches[0].recordIds?.[0]).toBe(60);              // las más recientes primero
    expect(searches[0].recordIds).not.toContain(10);         // las 10 más antiguas quedan fuera
    expect(await screen.findByText(/Hay 60 coincidencias: se muestran las 50 más recientes/)).toBeInTheDocument();
  });

  it("la coordinación busca como siempre: no tiene libreta", async () => {
    const { searches } = mockBackend();
    renderRecordRoutes("/historias", "COORDINATOR");
    await screen.findByRole("heading", { name: "Historias clínicas" });

    await userEvent.setup().type(searchBox(), "quispe");

    await waitFor(() => expect(searches).toEqual([{ q: "quispe" }]));
    expect(within(document.body).queryByText(/en este dispositivo/)).not.toBeInTheDocument();
  });
});

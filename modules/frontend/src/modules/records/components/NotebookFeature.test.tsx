import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/mocks/server";
import { renderWithProviders } from "@/test/utils";
import { useSessionStore } from "@/store/useSessionStore";
import { NotebookFeature } from "./NotebookFeature";
import { listEntries, putEntry } from "../notebook/notebookDb";
import { saveEntry } from "../notebook/notebookService";
import { EMPTY_NOTEBOOK_FIELDS, notebookEntrySchema, type NotebookEntry } from "../notebook/notebookSchema";
import { isSharedDevice, snoozeReminder } from "../notebook/notebookMarkers";
import { IMPORT_FAILED, exportNotebook, MIN_ITERATIONS } from "../notebook/notebookFile";

const PHRASE = "bada kepo luma sinu tove zaxi";

function entry(recordId: number, overrides: Partial<NotebookEntry> = {}): NotebookEntry {
  return notebookEntrySchema.parse({
    ...EMPTY_NOTEBOOK_FIELDS,
    fullName: `Paciente ${recordId}`,
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

/** El listado de historias del usuario (alimenta la importación: lo ajeno se omite). */
function serveOwnRecords(ids: number[]) {
  server.use(
    http.get("*/api/orthodontic-records", () =>
      HttpResponse.json({ content: ids.map((id) => ({ id })), page: 0, size: 100, totalElements: ids.length, totalPages: 1, last: true }),
    ),
  );
}

let downloads: { name: string; text: string }[];
beforeEach(() => {
  useSessionStore.setState({ accessToken: "t", status: "authenticated", user: { id: 1, email: "a@b.test", role: "USER", fullName: "Dra. Torres" } });
  downloads = [];
  vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
    void (blob as Blob).text().then((text) => (downloads[downloads.length - 1].text = text));
    downloads.push({ name: "", text: "" });
    return "blob:test";
  });
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    downloads[downloads.length - 1].name = this.download;
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("patient-notebook — exportar desde Mi libreta", () => {
  it("Exportar: muestra la frase una sola vez, pide confirmar que se guardó y descarga el archivo con nombre genérico", async () => {
    await saveEntry({ accountId: 1, recordId: 10, recordNumber: "AEO-0015", fields: { ...EMPTY_NOTEBOOK_FIELDS, fullName: "Ana Lucía Quispe Mamani" } });
    renderWithProviders(<NotebookFeature />);
    const user = userEvent.setup();

    expect(screen.getByText(/No envíes el archivo por correo ni lo guardes en nubes públicas/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Exportar libreta" }));
    const phrase = (await screen.findByLabelText("Frase de exportación", undefined, { timeout: 8000 })).textContent ?? "";
    expect(phrase.split(" ")).toHaveLength(6);

    const download = screen.getByRole("button", { name: "Descargar archivo" });
    expect(download).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: "Guardé la frase en un lugar seguro" }));
    await user.click(download);

    await waitFor(() => expect(downloads[0]?.name).toMatch(/^libreta-\d{8}\.hsflibreta$/));
    await waitFor(() => expect(downloads[0].text).not.toBe(""));
    expect(downloads[0].name).not.toMatch(/Ana|Quispe/);
    expect(downloads[0].text).not.toContain("Quispe");
    // La frase ya no se muestra y las entradas quedan marcadas como exportadas.
    expect(await screen.findByText(/La frase no se mostrará otra vez/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Frase de exportación")).not.toBeInTheDocument();
    expect((await listEntries(1))[0].exportedAt).not.toBeNull();
  }, 20000);

  it("Libreta vacía: indica que no hay nada que exportar y no genera archivo", async () => {
    renderWithProviders(<NotebookFeature />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Exportar libreta" }));

    expect(await screen.findByText(/No hay nada que exportar/)).toBeInTheDocument();
    expect(downloads).toEqual([]);
  });

  it("Sin criptografía del navegador: exportar e importar quedan deshabilitados con un aviso", () => {
    vi.stubGlobal("crypto", { getRandomValues: undefined, subtle: undefined });
    renderWithProviders(<NotebookFeature />);

    expect(screen.getByRole("alert")).toHaveTextContent(/no ofrece criptografía/);
    expect(screen.getByRole("button", { name: "Exportar libreta" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Importar" })).toBeDisabled();
    expect(downloads).toEqual([]);
  });
});

describe("patient-notebook — importar desde Mi libreta", () => {
  async function importWith(file: string, phrase: string) {
    const user = userEvent.setup();
    renderWithProviders(<NotebookFeature />);
    await user.upload(screen.getByLabelText(/Archivo de la libreta/), new File([file], "libreta.hsflibreta"));
    await user.type(screen.getByLabelText("Frase"), phrase);
    await user.click(screen.getByRole("button", { name: "Importar" }));
  }

  it("Importar en otro dispositivo: se agregan las entradas y se informa cuántas", async () => {
    serveOwnRecords([10, 11]);
    const file = await exportNotebook([entry(10), entry(11)], 1, PHRASE, { iterations: MIN_ITERATIONS });

    await importWith(file, PHRASE);

    expect(await screen.findByText(/Libreta importada: 2 agregadas, 0 reemplazadas, 0 omitidas, 0 conflictos/, undefined, { timeout: 8000 })).toBeInTheDocument();
    expect((await listEntries(1)).map((e) => e.recordId)).toEqual([10, 11]);
  }, 20000);

  it("Entradas de historias ajenas: se omiten y se informa cuántas", async () => {
    serveOwnRecords([10]);
    const file = await exportNotebook([entry(10), entry(99)], 1, PHRASE, { iterations: MIN_ITERATIONS });

    await importWith(file, PHRASE);

    expect(await screen.findByText(/1 de historias ajenas omitidas/, undefined, { timeout: 8000 })).toBeInTheDocument();
    expect((await listEntries(1)).map((e) => e.recordId)).toEqual([10]);
  }, 20000);

  it("Frase incorrecta o archivo alterado: 'No se pudo abrir el archivo', sin distinguir la causa, y la libreta no cambia", async () => {
    serveOwnRecords([10]);
    await putEntry(entry(10, { fullName: "Existente" }));
    const file = await exportNotebook([entry(10, { revision: 9, fullName: "Del archivo" })], 1, PHRASE, { iterations: MIN_ITERATIONS });

    await importWith(file, "bada kepo luma sinu tove zaxu");

    expect(await screen.findByRole("alert", undefined, { timeout: 8000 })).toHaveTextContent(IMPORT_FAILED);
    expect((await listEntries(1))[0].fullName).toBe("Existente");
  }, 20000);

  it("un archivo que no es una libreta se rechaza con el mismo mensaje", async () => {
    serveOwnRecords([10]);
    await importWith("{ esto no es una libreta }", PHRASE);
    expect(await screen.findByRole("alert")).toHaveTextContent(IMPORT_FAILED);
  });
});

describe("patient-notebook — recordatorio de exportar", () => {
  it("Recordatorio: con cambios sin exportar desde hace 7 días se muestra y se puede posponer", async () => {
    await putEntry(entry(10, { updatedAt: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString() }));
    renderWithProviders(<NotebookFeature />);

    expect(await screen.findByText(/Hace más de 7 días que tu libreta tiene cambios sin exportar/)).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Recordármelo mañana" }));
    await waitFor(() => expect(screen.queryByText(/Hace más de 7 días/)).not.toBeInTheDocument());
  });

  it("no recuerda si los cambios son recientes, si ya se exportaron o si está pospuesto", async () => {
    await putEntry(entry(10, { updatedAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString() }));
    await putEntry(entry(11, { updatedAt: "2026-01-01T00:00:00Z", exportedAt: "2026-01-02T00:00:00Z" }));
    renderWithProviders(<NotebookFeature />);
    await screen.findByRole("heading", { name: "Mi libreta" });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(screen.queryByText(/Hace más de 7 días/)).not.toBeInTheDocument();
  });

  it("pospuesto no se muestra aunque haya cambios viejos", async () => {
    await putEntry(entry(10, { updatedAt: "2026-01-01T00:00:00Z" }));
    snoozeReminder(1, new Date(Date.now() + 3600 * 1000));
    renderWithProviders(<NotebookFeature />);
    await screen.findByRole("heading", { name: "Mi libreta" });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(screen.queryByText(/Hace más de 7 días/)).not.toBeInTheDocument();
  });
});

describe("patient-notebook — equipo compartido y borrado", () => {
  it("Borrar la libreta: con confirmación se eliminan todas las entradas de la cuenta", async () => {
    await putEntry(entry(10));
    await putEntry(entry(11));
    await putEntry(entry(20, { accountId: 2 }));
    renderWithProviders(<NotebookFeature />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Borrar la libreta de este dispositivo" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent(/Las historias del servidor no cambian/);
    await user.click(within(dialog).getByRole("button", { name: "Borrar la libreta" }));

    expect(await screen.findByText(/Se borró la libreta de este dispositivo/)).toBeInTheDocument();
    expect(await listEntries(1)).toEqual([]);
    expect(await listEntries(2)).toHaveLength(1); // otra cuenta del mismo navegador: no se toca
  });

  it("cancelar el borrado no elimina nada", async () => {
    await putEntry(entry(10));
    renderWithProviders(<NotebookFeature />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Borrar la libreta de este dispositivo" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Cancelar" }));

    expect(await listEntries(1)).toHaveLength(1);
  });

  it("Este equipo es compartido: se recuerda en el dispositivo", async () => {
    renderWithProviders(<NotebookFeature />);
    expect(isSharedDevice()).toBe(false);

    await userEvent.setup().click(screen.getByRole("checkbox", { name: /Este equipo es compartido/ }));
    expect(isSharedDevice()).toBe(true);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/mocks/server";
import type { RecordResponse } from "@/modules/core/services/generated/model";
import { recordResponse } from "../../test/fixtures";
import { renderRecordRoutes } from "../../test/renderRecordRoutes";
import { saveEntry } from "../../notebook/notebookService";
import * as notebookDb from "../../notebook/notebookDb";
import { EMPTY_NOTEBOOK_FIELDS, type NotebookFields } from "../../notebook/notebookSchema";

const ANA: NotebookFields = {
  ...EMPTY_NOTEBOOK_FIELDS,
  fullName: "Ana Lucía Quispe Mamani",
  documentType: "DNI",
  documentNumber: "74125896",
  birthDate: "2012-05-20",
  birthPlace: "Arequipa",
  address: "Av. Sol 123",
  phone: "987654321",
  signerName: "Rosa Mamani",
  signerRelationship: "Madre",
};

/** Historia y registro de la impresión; guarda cada petición para comprobar que ninguna lleva la libreta. */
function serve(record: RecordResponse) {
  const printed: { calls: number; bodies: string[]; urls: string[] } = { calls: 0, bodies: [], urls: [] };
  server.use(
    http.get("*/api/orthodontic-records/:id", ({ request }) => {
      printed.urls.push(request.url);
      return HttpResponse.json(record);
    }),
    http.post("*/api/orthodontic-records/:id/print", async ({ request }) => {
      printed.calls += 1;
      printed.urls.push(request.url);
      printed.bodies.push(await request.text());
      return HttpResponse.json({ record: { ...record, patientLockedAt: "2026-10-05T15:00:00Z" }, printedOn: "2026-10-05", clinicalFilledSteps: 1 });
    }),
  );
  return printed;
}

const MINOR = recordResponse({ patientAlias: "Ana", patientSex: "FEMALE", patientAge: 13 });

let print: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  print = vi.spyOn(window, "print").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.useRealTimers();
  print.mockRestore();
  vi.restoreAllMocks();
});

const click = (name: string) => userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(screen.getByRole("button", { name }));

describe("patient-notebook — Hoja impresa con los datos de la libreta", () => {
  it("Imprimir con libreta: la hoja 1 y la de firmas muestran los datos junto al alias, el sexo y la edad", async () => {
    await saveEntry({ accountId: 1, recordId: 10, recordNumber: "AEO-0001", fields: ANA });
    const sent = serve(MINOR);
    renderRecordRoutes("/historias/10/imprimir");

    const first = (await screen.findAllByRole("article"))[0];
    await within(first).findByText("Ana Lucía Quispe Mamani");
    for (const text of ["DNI 74125896", "Arequipa, 20/05/2012", "Av. Sol 123", "987654321", "Ana", "13 años"]) {
      expect(within(first).getByText(text)).toBeInTheDocument();
    }
    // Menor de edad: firma el apoderado, con el nombre y el parentesco de la libreta.
    const signatures = screen.getByText("FIRMA DEL APODERADO:").closest("article")!;
    expect(within(signatures).getByText("Rosa Mamani")).toBeInTheDocument();
    expect(within(signatures).getByText("Madre")).toBeInTheDocument();

    // Imprimir registra solo el identificador y la marca de avance: nada de la libreta viaja.
    await click("Imprimir");
    await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
    expect(sent.calls).toBe(1);
    const traffic = [...sent.bodies, ...sent.urls].join("\n");
    for (const fragment of ["Quispe", "Mamani", "74125896", "5896", "Sol 123", "987654321", "Arequipa", "Rosa"]) {
      expect(traffic).not.toContain(fragment);
    }
    expect(JSON.parse(sent.bodies[0])).toEqual({ filledSteps: [1] });
  });

  it("Imprimir sin libreta: esas líneas salen en blanco para escribirlas a mano", async () => {
    serve(MINOR);
    renderRecordRoutes("/historias/10/imprimir");

    const first = (await screen.findAllByRole("article"))[0];
    for (const label of ["Nombre y apellidos", "Documento", "Domicilio", "Celular", "Lugar y fecha de nacimiento del paciente"]) {
      expect(within(first).getByText(`${label}:`).parentElement?.textContent).toBe(`${label}:`);
    }
    await click("Imprimir");
    await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
  });

  it("Título y archivo del PDF: el título del documento no lleva nombre, documento ni alias", async () => {
    await saveEntry({ accountId: 1, recordId: 10, recordNumber: "AEO-0001", fields: ANA });
    serve(MINOR);
    renderRecordRoutes("/historias/10/imprimir");
    await screen.findAllByRole("article");

    expect(document.title).toBe("Historia clínica de ortodoncia");
    for (const fragment of ["Ana", "Quispe", "74125896"]) expect(document.title).not.toContain(fragment);
  });

  it("Entrada de otra historia con el mismo identificador: no se imprime y se avisa", async () => {
    await saveEntry({ accountId: 1, recordId: 10, recordNumber: "AEO-0031", fields: ANA });
    serve(MINOR);
    renderRecordRoutes("/historias/10/imprimir");

    expect(await screen.findByText(/no corresponde y se ignora/)).toBeInTheDocument();
    const first = (await screen.findAllByRole("article"))[0];
    expect(within(first).queryByText("Ana Lucía Quispe Mamani")).not.toBeInTheDocument();
    expect(within(first).queryByText(/74125896/)).not.toBeInTheDocument();
  });

  it("Fallo de lectura de la libreta al imprimir: no registra ni fija; se puede reintentar o imprimir en blanco", async () => {
    await saveEntry({ accountId: 1, recordId: 10, recordNumber: "AEO-0001", fields: ANA });
    const sent = serve(MINOR);
    renderRecordRoutes("/historias/10/imprimir");
    await within((await screen.findAllByRole("article"))[0]).findByText("Ana Lucía Quispe Mamani");

    const getEntry = vi.spyOn(notebookDb, "getEntry").mockRejectedValue(new notebookDb.NotebookError("unknown"));
    await click("Imprimir");

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/No se pudo leer la libreta/);
    expect(print).not.toHaveBeenCalled();
    expect(sent.calls).toBe(0);

    // Reintentar con la lectura recuperada: imprime con los datos y registra una vez.
    getEntry.mockRestore();
    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(within(alert).getByRole("button", { name: "Reintentar" }));
    await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
    expect(sent.calls).toBe(1);
  });

  it("imprimir con las líneas en blanco tras un fallo de lectura sigue el flujo normal: registra y fija", async () => {
    await saveEntry({ accountId: 1, recordId: 10, recordNumber: "AEO-0001", fields: ANA });
    const sent = serve(MINOR);
    renderRecordRoutes("/historias/10/imprimir");
    await within((await screen.findAllByRole("article"))[0]).findByText("Ana Lucía Quispe Mamani");

    vi.spyOn(notebookDb, "getEntry").mockRejectedValue(new notebookDb.NotebookError("blocked"));
    await click("Imprimir");
    const alert = await screen.findByRole("alert");
    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(within(alert).getByRole("button", { name: "Imprimir con líneas en blanco" }));

    await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
    expect(sent.calls).toBe(1);
  });

  it("sin IndexedDB en el navegador no hay libreta: imprime en blanco sin error", async () => {
    vi.stubGlobal("indexedDB", undefined);
    const sent = serve(MINOR);
    renderRecordRoutes("/historias/10/imprimir");
    await screen.findAllByRole("article");

    await click("Imprimir");
    await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(sent.calls).toBe(1);
    vi.unstubAllGlobals();
  });

  it("Entrada que cambia mientras se imprime: la hoja usa la copia tomada antes de registrar y reimprimir toma otra", async () => {
    await saveEntry({ accountId: 1, recordId: 10, recordNumber: "AEO-0001", fields: ANA });
    const sent = serve(MINOR);
    // Otra pestaña edita la entrada justo después de la copia, mientras responde el registro.
    server.use(
      http.post("*/api/orthodontic-records/:id/print", async ({ request }) => {
        sent.calls += 1;
        sent.bodies.push(await request.text());
        await saveEntry({ accountId: 1, recordId: 10, recordNumber: "AEO-0001", fields: { ...ANA, fullName: "Editada en otra pestaña" } });
        return HttpResponse.json({ record: { ...MINOR, patientLockedAt: "2026-10-05T15:00:00Z" }, printedOn: "2026-10-05", clinicalFilledSteps: 1 });
      }),
    );
    renderRecordRoutes("/historias/10/imprimir");
    await within((await screen.findAllByRole("article"))[0]).findByText("Ana Lucía Quispe Mamani");

    let printedText = "";
    print.mockImplementation(() => {
      printedText = document.body.textContent ?? "";
    });
    await click("Imprimir");
    await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
    expect(printedText).toContain("Ana Lucía Quispe Mamani");
    expect(printedText).not.toContain("Editada en otra pestaña");

    // Reimprimir toma una copia nueva.
    await click("Imprimir");
    await waitFor(() => expect(print).toHaveBeenCalledTimes(2));
    expect(printedText).toContain("Editada en otra pestaña");
  });

  it("los campos se escapan: HTML y scripts se imprimen como texto", async () => {
    await saveEntry({
      accountId: 1,
      recordId: 10,
      recordNumber: "AEO-0001",
      fields: { ...ANA, fullName: "<script>alert(1)</script><img src=x onerror=alert(2)>", address: "<b>negrita</b>" },
    });
    serve(MINOR);
    const { container } = renderRecordRoutes("/historias/10/imprimir");

    const first = (await screen.findAllByRole("article"))[0];
    await within(first).findByText("<b>negrita</b>");
    expect(first.textContent).toContain("<script>alert(1)</script>");
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img[onerror]")).toBeNull();
    expect(Array.from(container.querySelectorAll("article b")).some((b) => b.textContent === "negrita")).toBe(false);
  });
});

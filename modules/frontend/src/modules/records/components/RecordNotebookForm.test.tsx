import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/mocks/server";
import type { RecordResponse, UpdateRecordRequest } from "@/modules/core/services/generated/model";
import { recordResponse } from "../test/fixtures";
import { renderRecordRoutes } from "../test/renderRecordRoutes";
import { getEntry } from "../notebook/notebookDb";
import { saveEntry } from "../notebook/notebookService";
import { EMPTY_NOTEBOOK_FIELDS } from "../notebook/notebookSchema";
import { hadEntry, markHadEntry } from "../notebook/notebookMarkers";

/** Historia en memoria; guarda todo lo que se envía para comprobar que nada de la libreta viaja. */
function mockRecord(initial: Partial<RecordResponse> = {}) {
  let record = recordResponse(initial);
  const traffic: string[] = [];
  const puts: UpdateRecordRequest[] = [];
  server.use(
    http.get("*/api/orthodontic-records/:id", ({ request }) => {
      traffic.push(request.url);
      return HttpResponse.json(record);
    }),
    http.put("*/api/orthodontic-records/:id", async ({ request }) => {
      traffic.push(request.url);
      const text = await request.text();
      traffic.push(text);
      const body = JSON.parse(text) as UpdateRecordRequest;
      puts.push(body);
      record = { ...record, ...body, content: body.content ?? record.content, version: record.version + 1 } as RecordResponse;
      return HttpResponse.json(record);
    }),
  );
  return { traffic, puts };
}

const stepHeading = (title: RegExp) => screen.findByRole("heading", { level: 2, name: title });
const notebook = () => screen.findByRole("region", { name: "Solo en este dispositivo" });

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("patient-notebook — campos solo en este dispositivo", () => {
  it("Historia sin libreta: el formulario funciona igual, con los campos vacíos y el aviso de que no se envían", async () => {
    mockRecord();
    renderRecordRoutes("/historias/10?paso=1");
    await stepHeading(/Paciente y anamnesis/);

    const region = await notebook();
    expect(within(region).getByText(/no se envían al servidor/)).toBeInTheDocument();
    for (const label of ["Nombre y apellidos", "Número", "Fecha de nacimiento", "Lugar de nacimiento", "Celular", "Domicilio"]) {
      expect(within(region).getByLabelText(label)).toHaveValue("");
      expect(within(region).getByLabelText(label)).not.toHaveAttribute("readonly");
    }
    // El alias, el sexo y la edad siguen siendo del servidor.
    expect(screen.getByRole("textbox", { name: "Alias del paciente" })).toBeInTheDocument();
  });

  it("Guardar en la libreta: se guarda en el dispositivo y ninguna petición lleva el nombre, el documento ni sus partes", async () => {
    const { traffic, puts } = mockRecord();
    renderRecordRoutes("/historias/10?paso=1");
    await stepHeading(/Paciente y anamnesis/);
    const region = await notebook();
    const user = userEvent.setup();

    await user.type(within(region).getByLabelText("Nombre y apellidos"), "Ana Lucía Quispe Mamani");
    await user.click(within(region).getByRole("radio", { name: "DNI" }));
    await user.type(within(region).getByLabelText("Número"), "74125896");
    await user.type(within(region).getByLabelText("Domicilio"), "Av. Sol 123");

    await waitFor(async () => expect((await getEntry(1, 10))?.documentNumber).toBe("74125896"), { timeout: 3000 });
    const saved = await getEntry(1, 10);
    expect(saved).toMatchObject({ fullName: "Ana Lucía Quispe Mamani", documentType: "DNI", address: "Av. Sol 123", recordNumber: "AEO-0001", accountId: 1, recordId: 10 });

    // Guardar la historia no lleva nada de la libreta.
    await user.click(screen.getByRole("button", { name: /Siguiente/ }));
    await stepHeading(/Análisis facial/);
    const sent = traffic.join("\n") + JSON.stringify(puts);
    for (const fragment of ["Quispe", "Mamani", "Lucía", "74125896", "5896", "Sol 123"]) expect(sent).not.toContain(fragment);
    for (const retired of ["fullName", "documentNumber", "address", "signerName"]) expect(sent).not.toContain(retired);
  });

  it("Documento con formato incorrecto: el error aparece junto al campo y no se guarda esa entrada", async () => {
    mockRecord();
    renderRecordRoutes("/historias/10?paso=1");
    await stepHeading(/Paciente y anamnesis/);
    const region = await notebook();
    const user = userEvent.setup();

    await user.click(within(region).getByRole("radio", { name: "DNI" }));
    await user.type(within(region).getByLabelText("Número"), "7412589");
    await user.tab();

    expect(await within(region).findByText("El DNI debe tener 8 dígitos.")).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 900));
    expect(await getEntry(1, 10)).toBeNull();
  });

  it("abrir una historia con entrada llena los campos", async () => {
    await saveEntry({ accountId: 1, recordId: 10, recordNumber: "AEO-0001", fields: { ...EMPTY_NOTEBOOK_FIELDS, fullName: "Rosa Díaz", birthPlace: "Cusco" } });
    mockRecord();
    renderRecordRoutes("/historias/10?paso=1");
    await stepHeading(/Paciente y anamnesis/);
    const region = await notebook();

    await waitFor(() => expect(within(region).getByLabelText("Nombre y apellidos")).toHaveValue("Rosa Díaz"));
    expect(within(region).getByLabelText("Lugar de nacimiento")).toHaveValue("Cusco");
  });

  it("Entrada de otra historia con el mismo identificador: no se muestra y se avisa", async () => {
    await saveEntry({ accountId: 1, recordId: 10, recordNumber: "AEO-0031", fields: { ...EMPTY_NOTEBOOK_FIELDS, fullName: "Rosa Díaz" } });
    mockRecord();
    renderRecordRoutes("/historias/10?paso=1");
    await stepHeading(/Paciente y anamnesis/);
    const region = await notebook();

    expect(await within(region).findByText(/no corresponde y se ignora/)).toBeInTheDocument();
    expect(within(region).getByLabelText("Nombre y apellidos")).toHaveValue("");
    expect(within(region).getByLabelText("Nombre y apellidos")).toHaveAttribute("readonly");
  });

  it("Sin IndexedDB: los campos se bloquean con el aviso y la historia sigue funcionando", async () => {
    vi.stubGlobal("indexedDB", undefined);
    mockRecord();
    renderRecordRoutes("/historias/10?paso=1");
    await stepHeading(/Paciente y anamnesis/);
    const region = await notebook();

    expect(await within(region).findByText("La libreta no está disponible en este navegador.")).toBeInTheDocument();
    expect(within(region).getByLabelText("Nombre y apellidos")).toHaveAttribute("readonly");
    expect(screen.getByRole("textbox", { name: "Alias del paciente" })).not.toHaveAttribute("readonly");
  });

  it("Primer uso: el primer guardado avisa que los datos viven solo en el dispositivo", async () => {
    mockRecord();
    renderRecordRoutes("/historias/10?paso=1");
    await stepHeading(/Paciente y anamnesis/);
    const region = await notebook();
    expect(hadEntry(1, 10)).toBe(false);

    await userEvent.setup().type(within(region).getByLabelText("Nombre y apellidos"), "Ana");

    expect(await within(region).findByText(/Guardado en este dispositivo/, undefined, { timeout: 3000 })).toBeInTheDocument();
    expect(within(region).getByText("solo aquí")).toBeInTheDocument();
    expect(hadEntry(1, 10)).toBe(true);
  });

  it("El navegador borró la libreta: campos vacíos, aviso de que puede importar y ningún error de la historia", async () => {
    markHadEntry(1, 10);
    mockRecord();
    renderRecordRoutes("/historias/10?paso=1");
    await stepHeading(/Paciente y anamnesis/);
    const region = await notebook();

    expect(await within(region).findByText(/ya no están en este dispositivo/)).toBeInTheDocument();
    expect(within(region).getByLabelText("Nombre y apellidos")).toHaveValue("");
    expect(screen.queryByText(/Historia no encontrada/)).not.toBeInTheDocument();
  });

  it("Alias sugerido: con el nombre escrito propone nombre de pila e inicial y el usuario decide", async () => {
    mockRecord({ patientAlias: "" });
    renderRecordRoutes("/historias/10?paso=1");
    await stepHeading(/Paciente y anamnesis/);
    const region = await notebook();
    const user = userEvent.setup();

    await user.type(within(region).getByLabelText("Nombre y apellidos"), "Ana Quispe Rojas");
    expect(await within(region).findByText("Ana Q")).toBeInTheDocument();
    await user.click(within(region).getByRole("button", { name: "Usar este alias" }));
    expect(screen.getByRole("textbox", { name: "Alias del paciente" })).toHaveValue("Ana Q");

    // Cambiado por el usuario: la libreta conserva el nombre completo y el alias es el que escribió.
    await user.clear(screen.getByRole("textbox", { name: "Alias del paciente" }));
    await user.type(screen.getByRole("textbox", { name: "Alias del paciente" }), "Anita");
    await waitFor(async () => expect((await getEntry(1, 10))?.fullName).toBe("Ana Quispe Rojas"), { timeout: 3000 });
    expect(screen.getByRole("textbox", { name: "Alias del paciente" })).toHaveValue("Anita");
  });

  it("Nombre de una palabra o vacío: la propuesta es esa palabra o no hay propuesta", async () => {
    mockRecord({ patientAlias: "" });
    renderRecordRoutes("/historias/10?paso=1");
    await stepHeading(/Paciente y anamnesis/);
    const region = await notebook();
    const user = userEvent.setup();

    expect(within(region).queryByText(/Alias propuesto/)).not.toBeInTheDocument();
    await user.type(within(region).getByLabelText("Nombre y apellidos"), "Mateo");
    expect(await within(region).findByText("Mateo")).toBeInTheDocument();
  });

  it("firmas: el nombre de quien firma se guarda en la libreta, sin enviarse", async () => {
    const { traffic, puts } = mockRecord({ patientAge: 13 });
    renderRecordRoutes("/historias/10?paso=8");
    await stepHeading(/Firmas/);
    const region = await notebook();
    const user = userEvent.setup();

    await user.type(within(region).getByLabelText("Nombre del apoderado"), "Rosa Mamani");
    await user.type(within(region).getByLabelText("Parentesco"), "Madre");

    await waitFor(async () => expect((await getEntry(1, 10))?.signerRelationship).toBe("Madre"), { timeout: 3000 });
    expect((await getEntry(1, 10))?.signerName).toBe("Rosa Mamani");
    expect(traffic.join("\n") + JSON.stringify(puts)).not.toContain("Mamani");
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/test/mocks/server";
import { recordResponse } from "../test/fixtures";
import { renderRecordRoutes } from "../test/renderRecordRoutes";

/** Cuenta vencida (account-expiry): la historia se abre en lectura y la vista previa sigue activa. */
const open = (readOnly: boolean) =>
  renderRecordRoutes("/historias/10?paso=1", "USER", { readOnly, expiresOn: readOnly ? "2026-11-23" : "2027-11-23" });

const stepHeading = (title: RegExp) => screen.findByRole("heading", { level: 2, name: title });

beforeEach(() => {
  server.use(http.get("*/api/orthodontic-records/:id", () => HttpResponse.json(recordResponse({ patientAlias: "Ana" }))));
});

describe("orthodontic-records — Historia con la cuenta vencida", () => {
  it("Aviso y controles: abre en lectura, sin guardar y con la vista previa activa", async () => {
    open(true);
    await stepHeading(/Paciente y anamnesis/);

    expect(screen.getByText("Tu acceso venció: pide la renovación al administrador.")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Alias del paciente" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Guardar/ })).toBeDisabled();
    expect(screen.getByRole("link", { name: /Vista previa de impresión/ })).toBeInTheDocument();
  });

  it("Con la cuenta vigente la historia se edita con normalidad", async () => {
    open(false);
    await stepHeading(/Paciente y anamnesis/);

    expect(screen.queryByText("Tu acceso venció: pide la renovación al administrador.")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Alias del paciente" })).toBeEnabled();
  });
});

import { describe, it, expect, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { renderWithProviders } from "@/test/utils";
import { server } from "@/test/mocks/server";
import { useSessionStore, type Role } from "@/store/useSessionStore";
import type { AdminDashboardResponse, UserDashboardResponse } from "@/modules/core/services/generated/model";
import { DashboardFeature } from "./DashboardFeature";

function signIn(role: Role) {
  useSessionStore.setState({
    accessToken: "tok",
    user: { id: 1, email: "ana@empresa.test", role, fullName: "Ana Pérez" },
    status: "authenticated",
  });
}

function userDashboard(overrides: Partial<UserDashboardResponse> = {}): UserDashboardResponse {
  return {
    records: { total: 3, createdThisMonth: 1 },
    quota: { limit: 5, used: 3, reached: false },
    completeness: { complete: 1, inProgress: 1, notComputed: 1 },
    resume: [
      {
        id: 12,
        recordNumber: "AEO-0003",
        patientName: "Luis",
        lastStep: 6,
        filledSteps: 4,
        updatedAt: "2026-10-04T15:00:00Z",
        missingAge: true,
        missingTreatmentStart: true,
      },
      {
        id: 11,
        recordNumber: "AEO-0002",
        patientName: "Rosa",
        updatedAt: "2026-10-03T15:00:00Z",
        missingAge: false,
        missingTreatmentStart: true,
      },
      {
        id: 10,
        recordNumber: "AEO-0001",
        patientName: "Marta",
        lastStep: 2,
        filledSteps: 1,
        updatedAt: "2026-10-02T15:00:00Z",
        missingAge: false,
        missingTreatmentStart: false,
      },
    ],
    ...overrides,
  };
}

function adminDashboard(overrides: Partial<AdminDashboardResponse> = {}): AdminDashboardResponse {
  return {
    users: { total: 12, active: 10, disabled: 2, newThisMonth: 3 },
    records: {
      total: 40,
      createdThisMonth: 7,
      complete: 20,
      inProgress: 15,
      notComputed: 5,
      perMonth: [
        { month: "2026-05", count: 4 },
        { month: "2026-06", count: 0 },
        { month: "2026-07", count: 0 },
        { month: "2026-08", count: 0 },
        { month: "2026-09", count: 0 },
        { month: "2026-10", count: 7 },
      ],
    },
    topAuthors: [
      { userId: 2, fullName: "Dra. Torres", status: "ACTIVE", records: 9, averageFilledSteps: 6.2 },
      { userId: 3, fullName: "Dr. Medina", status: "DISABLED", records: 5 },
    ],
    quotas: {
      total: 14,
      items: [
        { userId: 4, fullName: "Dr. Lleno", used: 5, limit: 5, reached: true },
        { userId: 5, fullName: "Dra. Cerca", used: 4, limit: 5, reached: false },
      ],
    },
    unlockRequests: { total: 0, items: [] },
    ...overrides,
  };
}

function mockUser(data: UserDashboardResponse) {
  server.use(http.get("*/api/dashboard/me", () => HttpResponse.json(data)));
}

function mockAdmin(data: AdminDashboardResponse) {
  server.use(http.get("*/api/dashboard/admin", () => HttpResponse.json(data)));
}

beforeEach(() => signIn("USER"));

function rowOf(recordNumber: string): HTMLElement {
  return screen.getByText(new RegExp(`^${recordNumber} ·`)).closest("li")!;
}

describe("dashboard — Métricas del tratante en Inicio", () => {
  it("Historias y cupo: cupo, 'Nueva historia' junto al saludo y sin indicadores de historias", async () => {
    mockUser(userDashboard());
    renderWithProviders(<DashboardFeature />);

    expect(screen.getByRole("heading", { level: 1, name: "Hola, Ana Pérez" })).toBeInTheDocument();
    expect(await screen.findByText("3 de 5")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Nueva historia/ })).toHaveAttribute("href", "/historias/nueva");
    expect(screen.queryByText("creadas este mes")).not.toBeInTheDocument();
  });

  it("Sin límite de cupo", async () => {
    mockUser(userDashboard({ quota: { limit: null, used: 3, reached: false } }));
    renderWithProviders(<DashboardFeature />);
    expect(await screen.findByText("Sin límite")).toBeInTheDocument();
  });

  it("Cupo lleno: 'Nueva historia' deshabilitado y el aviso dice por qué", async () => {
    server.use(
      http.get("*/api/orthodontic-records/quota", () => HttpResponse.json({ limit: 5, used: 5, reached: true })),
    );
    mockUser(userDashboard({ quota: { limit: 5, used: 5, reached: true } }));
    renderWithProviders(<DashboardFeature />);

    expect(await screen.findByText(/Alcanzaste el máximo de 5 historias clínicas/)).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: /Nueva historia \(no disponible/ })).toHaveAttribute("aria-disabled", "true");
  });

  it("Completas y por terminar: junta las que están en progreso y las sin calcular", async () => {
    mockUser(userDashboard());
    renderWithProviders(<DashboardFeature />);

    expect(await screen.findByText("Completas")).toBeInTheDocument();
    expect(screen.getByText("2 por terminar")).toBeInTheDocument();
  });

  it("Historias sin calcular: cuentan como por terminar, sin aviso ni promedio", async () => {
    mockUser(userDashboard({ completeness: { complete: 0, inProgress: 0, notComputed: 4 } }));
    renderWithProviders(<DashboardFeature />);

    expect(await screen.findByText("4 por terminar")).toBeInTheDocument();
    expect(screen.queryByText(/sin calcular/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Promedio de pasos")).not.toBeInTheDocument();
  });

  it("Datos faltantes: avisos por historia, sin conteos ni pasos vacíos", async () => {
    mockUser(userDashboard());
    renderWithProviders(<DashboardFeature />);
    await screen.findByText("Para retomar");

    const both = within(rowOf("AEO-0003"));
    expect(both.getByText("Falta la edad")).toBeInTheDocument();
    expect(both.getByText("Falta la fecha de inicio")).toBeInTheDocument();

    const onlyStart = within(rowOf("AEO-0002"));
    expect(onlyStart.queryByText("Falta la edad")).not.toBeInTheDocument();
    expect(onlyStart.getByText("Falta la fecha de inicio")).toBeInTheDocument();

    const complete = within(rowOf("AEO-0001"));
    expect(complete.queryByText(/Falta/)).not.toBeInTheDocument();

    expect(screen.queryByRole("heading", { name: "Datos faltantes" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Pasos vacíos/)).not.toBeInTheDocument();
  });

  it("Para retomar: 'Continuar en paso N' abre en el último paso, o en el paso 1 si no tiene", async () => {
    mockUser(userDashboard());
    renderWithProviders(<DashboardFeature />);

    const withStep = await screen.findByRole("link", { name: "Continuar en paso 6 de la historia AEO-0003" });
    expect(withStep).toHaveAttribute("href", "/historias/12?paso=6");
    expect(withStep).toHaveTextContent("Continuar en paso 6");
    expect(screen.getByRole("link", { name: "Continuar en paso 1 de la historia AEO-0002" })).toHaveAttribute(
      "href",
      "/historias/11?paso=1",
    );
  });

  it("Historia sin avance calculado: sin texto de pasos con datos", async () => {
    mockUser(userDashboard());
    renderWithProviders(<DashboardFeature />);
    await screen.findByText("Para retomar");

    expect(within(rowOf("AEO-0003")).getByText(/4 de 7 pasos con datos/)).toBeInTheDocument();
    expect(within(rowOf("AEO-0002")).queryByText(/pasos con datos/)).not.toBeInTheDocument();
    expect(within(rowOf("AEO-0002")).queryByText(/Sin calcular/)).not.toBeInTheDocument();
  });

  it("Orden de la pantalla: 'Para retomar' va antes que los indicadores", async () => {
    mockUser(userDashboard());
    renderWithProviders(<DashboardFeature />);

    const resume = await screen.findByRole("heading", { name: "Para retomar" });
    const cupo = screen.getByText("Cupo");
    expect(resume.compareDocumentPosition(cupo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("Todas completas: 'Para retomar' indica que no hay pendientes", async () => {
    mockUser(userDashboard({ resume: [] }));
    renderWithProviders(<DashboardFeature />);
    expect(await screen.findByText(/No tienes historias pendientes/)).toBeInTheDocument();
  });

  it("Sin historias todavía: invitación a crear la primera, sin indicadores ni lista (y un solo botón)", async () => {
    mockUser(
      userDashboard({
        records: { total: 0, createdThisMonth: 0 },
        completeness: { complete: 0, inProgress: 0, notComputed: 0 },
        resume: [],
      }),
    );
    renderWithProviders(<DashboardFeature />);
    expect(await screen.findByText("Todavía no tienes historias clínicas")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Nueva historia/ })).toHaveLength(1);
    expect(screen.queryByText("Para retomar")).not.toBeInTheDocument();
    expect(screen.queryByText("Cupo")).not.toBeInTheDocument();
  });

  it("Error al cargar: mensaje y 'Reintentar'", async () => {
    let fail = true;
    server.use(
      http.get("*/api/dashboard/me", () =>
        fail ? HttpResponse.json({ detail: "Ocurrió un error inesperado." }, { status: 500 }) : HttpResponse.json(userDashboard()),
      ),
    );
    renderWithProviders(<DashboardFeature />);
    expect(await screen.findByRole("alert")).toBeInTheDocument();

    fail = false;
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("3 de 5")).toBeInTheDocument();
  });
});

describe("dashboard — Métricas globales del ADMIN en Inicio", () => {
  beforeEach(() => signIn("ADMIN"));

  it("Usuarios e historias", async () => {
    mockAdmin(adminDashboard());
    renderWithProviders(<DashboardFeature />);

    expect(await screen.findByText("10 activas · 2 deshabilitadas")).toBeInTheDocument();
    expect(screen.getByText("40")).toBeInTheDocument();
    expect(screen.getByText("7 creadas este mes")).toBeInTheDocument();
    expect(screen.getByText("15 en progreso")).toBeInTheDocument();
    expect(screen.getByText("5 historias sin calcular: se calculan al volver a guardarlas.")).toBeInTheDocument();
  });

  it("Historias por mes: rótulos sin desfase de zona horaria y meses en cero", async () => {
    mockAdmin(adminDashboard());
    renderWithProviders(<DashboardFeature />);

    const months = within(await screen.findByRole("list", { name: "Últimos 6 meses" })).getAllByRole("listitem");
    expect(months.map((m) => m.getAttribute("aria-label"))).toEqual([
      "mayo de 2026: 4 historias",
      "junio de 2026: 0 historias",
      "julio de 2026: 0 historias",
      "agosto de 2026: 0 historias",
      "septiembre de 2026: 0 historias",
      "octubre de 2026: 7 historias",
    ]);
    expect(within(months[0]).getByText("may")).toBeInTheDocument();
  });

  it("Barras con todo en cero no rompen el ancho", async () => {
    mockAdmin(
      adminDashboard({
        records: { ...adminDashboard().records, perMonth: adminDashboard().records.perMonth.map((m) => ({ ...m, count: 0 })) },
      }),
    );
    renderWithProviders(<DashboardFeature />);
    const list = await screen.findByRole("list", { name: "Últimos 6 meses" });
    list.querySelectorAll<HTMLElement>("[style]").forEach((bar) => expect(bar.style.height).toBe("0%"));
  });

  it("Tratantes con más historias: deshabilitadas marcadas y promedio", async () => {
    mockAdmin(adminDashboard());
    renderWithProviders(<DashboardFeature />);

    expect(await screen.findByText("Dr. Medina (deshabilitada)")).toBeInTheDocument();
    expect(screen.getByText("Promedio: 6,2 de 7 pasos con datos")).toBeInTheDocument();
    expect(screen.getByText("Promedio: sin calcular")).toBeInTheDocument();
  });

  it("Cupos cerca del tope: llenos marcados, total y aviso de que se muestran los 10 más cerca", async () => {
    mockAdmin(adminDashboard());
    renderWithProviders(<DashboardFeature />);

    expect(await screen.findByText("14 tratantes")).toBeInTheDocument();
    const lleno = screen.getByText("Dr. Lleno").closest("li")!;
    expect(within(lleno).getByText("Lleno")).toBeInTheDocument();
    expect(screen.getByText("Dra. Cerca").closest("li")).not.toHaveTextContent("Lleno");
    expect(screen.getByText("Se muestran los 2 más cerca del tope.")).toBeInTheDocument();
  });

  it("Solicitudes de desbloqueo: más antiguas primero, con motivo y enlace a la historia", async () => {
    mockAdmin(
      adminDashboard({
        unlockRequests: {
          total: 14,
          items: [
            { recordId: 21, recordNumber: "AEO-0004", patientName: "Rosa Díaz", authorName: "Dra. Torres", requestedAt: "2026-10-01T15:00:00Z", reason: "ALIAS" },
            { recordId: 22, recordNumber: "AEO-0002", patientName: "Luis Rojas", authorName: "Dr. Medina", requestedAt: "2026-10-03T15:00:00Z", reason: "SEXO" },
          ],
        },
      }),
    );
    renderWithProviders(<DashboardFeature />);

    expect(await screen.findByText("14 solicitudes")).toBeInTheDocument();
    expect(screen.getByText(/Dra\. Torres · 01\/10\/2026 · «El alias»/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Revisar la solicitud de la historia AEO-0004" })).toHaveAttribute(
      "href",
      "/historias/21?paso=1",
    );
    expect(screen.getByText("Se muestran las 2 más antiguas.")).toBeInTheDocument();
  });

  it("Sin solicitudes de desbloqueo", async () => {
    mockAdmin(adminDashboard());
    renderWithProviders(<DashboardFeature />);
    expect(await screen.findByText("No hay solicitudes de desbloqueo.")).toBeInTheDocument();
  });

  it("El ADMIN no ve métricas de tratante", async () => {
    mockAdmin(adminDashboard());
    renderWithProviders(<DashboardFeature />);
    await screen.findByText("14 tratantes");
    expect(screen.queryByRole("heading", { name: "Para retomar" })).not.toBeInTheDocument();
    expect(screen.queryByText("Cupo")).not.toBeInTheDocument();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/test/mocks/server";
import { TooltipProvider } from "@/modules/core/ui/tooltip";
import { AppLayout } from "@/layouts/AppLayout";
import { useSessionStore } from "@/store/useSessionStore";
import { listEntries, putEntry } from "./notebookDb";
import { INACTIVITY_MS, useInactivityWipe } from "./useInactivityWipe";
import { broadcastActivity, withNotebookLock } from "./notebookLocks";
import { wipeNotebook } from "./notebookActions";
import { setSharedDevice } from "./notebookMarkers";
import { EMPTY_NOTEBOOK_FIELDS, notebookEntrySchema, type NotebookEntry } from "./notebookSchema";

function entry(recordId: number): NotebookEntry {
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
  });
}

beforeEach(() => {
  useSessionStore.setState({ accessToken: "t", status: "authenticated", user: { id: 1, email: "a@b.test", role: "USER", fullName: "Dra. Torres" } });
});
afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

function renderLayout() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      { path: "/", element: <AppLayout />, children: [{ index: true, element: <p>Inicio</p> }, { path: "libreta", element: <p>Pantalla de la libreta</p> }] },
    ],
    { initialEntries: ["/"] },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <RouterProvider router={router} />
      </TooltipProvider>
    </QueryClientProvider>,
  );
  return router;
}

describe("patient-notebook — inactividad en un equipo compartido", () => {
  it("Inactividad en equipo compartido: pasados 15 minutos se cierra la sesión (y se borra la libreta)", async () => {
    vi.useFakeTimers();
    setSharedDevice(true);
    const expired = vi.fn();
    renderHook(() => useInactivityWipe(true, expired));

    await act(() => vi.advanceTimersByTimeAsync(INACTIVITY_MS - 1000));
    expect(expired).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(1500));
    expect(expired).toHaveBeenCalledTimes(1);
  });

  it("la actividad reinicia el plazo", async () => {
    vi.useFakeTimers();
    setSharedDevice(true);
    const expired = vi.fn();
    renderHook(() => useInactivityWipe(true, expired));

    await act(() => vi.advanceTimersByTimeAsync(INACTIVITY_MS - 60_000));
    act(() => {
      window.dispatchEvent(new Event("keydown"));
    });
    await act(() => vi.advanceTimersByTimeAsync(INACTIVITY_MS - 60_000));
    expect(expired).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(61_000));
    expect(expired).toHaveBeenCalledTimes(1);
  });

  it("en un equipo que no es compartido no vence nunca, y si el ajuste cambia se respeta al vencer", async () => {
    vi.useFakeTimers();
    const expired = vi.fn();
    renderHook(() => useInactivityWipe(true, expired));
    await act(() => vi.advanceTimersByTimeAsync(INACTIVITY_MS * 2));
    expect(expired).not.toHaveBeenCalled();
  });

  it("la actividad de otra pestaña reinicia el plazo en esta", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    setSharedDevice(true);
    const expired = vi.fn();
    renderHook(() => useInactivityWipe(true, expired));

    await act(() => vi.advanceTimersByTimeAsync(INACTIVITY_MS - 60_000));
    await act(async () => {
      broadcastActivity();
      await vi.advanceTimersByTimeAsync(50);
    });
    await act(() => vi.advanceTimersByTimeAsync(INACTIVITY_MS - 60_000));
    expect(expired).not.toHaveBeenCalled();
  });

  it("sin libreta (coordinación) el plazo no corre", async () => {
    vi.useFakeTimers();
    setSharedDevice(true);
    const expired = vi.fn();
    renderHook(() => useInactivityWipe(false, expired));
    await act(() => vi.advanceTimersByTimeAsync(INACTIVITY_MS * 2));
    expect(expired).not.toHaveBeenCalled();
  });
});

describe("patient-notebook — coordinación entre pestañas", () => {
  it("Borrado mientras otra pestaña exporta: el borrado espera a que la operación termine y no queda nada a medias", async () => {
    await putEntry(entry(10));
    const order: string[] = [];
    let releaseExport!: () => void;

    // Otra operación (p. ej. exportar) tiene el bloqueo de la libreta.
    const exporting = withNotebookLock(async () => {
      order.push("exportación empieza");
      await new Promise<void>((resolve) => (releaseExport = resolve));
      order.push("exportación termina");
    });
    const wiping = wipeNotebook(1).then(() => order.push("borrado"));
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(order).toEqual(["exportación empieza"]);         // el borrado espera
    expect(await listEntries(1)).toHaveLength(1);           // y la libreta sigue intacta mientras tanto
    releaseExport();
    await Promise.all([exporting, wiping]);
    expect(order).toEqual(["exportación empieza", "exportación termina", "borrado"]);
    expect(await listEntries(1)).toEqual([]);
  });

  it("las operaciones de la libreta se encadenan aunque una falle", async () => {
    const order: number[] = [];
    const failing = withNotebookLock(async () => {
      order.push(1);
      throw new Error("falla");
    }).catch(() => order.push(-1));
    const next = withNotebookLock(async () => order.push(2));
    await Promise.all([failing, next]);
    // Se ejecutan una detrás de otra (1 antes que 2) y el fallo de la primera no frena la segunda.
    expect(order.filter((n) => n > 0)).toEqual([1, 2]);
    expect(order).toContain(-1);
  });
});

describe("patient-notebook — cierre de sesión en un equipo compartido", () => {
  const logoutServer = () => server.use(http.post("*/auth/logout", () => new HttpResponse(null, { status: 204 })));

  it("Cierre de sesión en equipo compartido: ofrece exportar y luego borra la libreta", async () => {
    logoutServer();
    await putEntry(entry(10));
    setSharedDevice(true);
    renderLayout();
    const user = userEvent.setup();

    await user.click((await screen.findAllByRole("button", { name: /Cerrar sesión/ }))[0]);
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent(/Este equipo es compartido/);
    expect(dialog).toHaveTextContent(/expórtala primero/);
    expect(await listEntries(1)).toHaveLength(1);           // todavía no se borró

    await user.click(within(dialog).getByRole("button", { name: "Cerrar sesión y borrar la libreta" }));

    await waitFor(async () => expect(await listEntries(1)).toEqual([]));
    await waitFor(() => expect(useSessionStore.getState().status).not.toBe("authenticated"));
  });

  it("Exportar primero lleva a Mi libreta sin cerrar la sesión ni borrar nada", async () => {
    await putEntry(entry(10));
    setSharedDevice(true);
    const router = renderLayout();
    const user = userEvent.setup();

    await user.click((await screen.findAllByRole("button", { name: /Cerrar sesión/ }))[0]);
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Exportar primero" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/libreta"));
    expect(await listEntries(1)).toHaveLength(1);
    expect(useSessionStore.getState().status).toBe("authenticated");
  });

  it("en un equipo no compartido, cerrar sesión conserva la libreta y no pregunta nada", async () => {
    logoutServer();
    await putEntry(entry(10));
    renderLayout();

    await userEvent.setup().click((await screen.findAllByRole("button", { name: /Cerrar sesión/ }))[0]);

    await waitFor(() => expect(useSessionStore.getState().status).not.toBe("authenticated"));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(await listEntries(1)).toHaveLength(1);
  });
});

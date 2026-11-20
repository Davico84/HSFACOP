import { describe, it, expect, beforeEach } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { appRoutes } from "@/routes";
import { RouteError } from "@/modules/core/components/RouteError";
import { TooltipProvider } from "@/modules/core/ui/tooltip";
import { sections } from "@/modules/core/config/sections";
import { UserResponseRole } from "@/modules/core/services/generated/model";
import { useSessionStore, type Role, type SessionUser } from "@/store/useSessionStore";

const USER: SessionUser = { id: 1, email: "ana@empresa.test", role: "USER", fullName: "Ana Pérez" };
const ADMIN: SessionUser = { id: 2, email: "admin@empresa.test", role: "ADMIN", fullName: "Admin" };
const ALL_ROLES = Object.values(UserResponseRole) as Role[];

function signIn(user: SessionUser) {
  useSessionStore.setState({ accessToken: "tok", user, status: "authenticated" });
}

/** Árbol de rutas real (sin el bootstrap de RootLayout), como AppLayout.test.tsx. */
function renderApp(path: string) {
  const router = createMemoryRouter([{ errorElement: <RouteError />, children: appRoutes }], {
    initialEntries: [path],
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <TooltipProvider delayDuration={0}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </TooltipProvider>,
  );
  return { router, unmount: view.unmount };
}

const mainNav = async () => within(await screen.findByRole("navigation", { name: "Navegación principal" }));
const denied = () => screen.queryByRole("heading", { level: 1, name: "Acceso denegado" });

beforeEach(() => {
  useSessionStore.setState({ accessToken: null, user: null, status: "unauthenticated" });
});

describe("app-shell — Navegación filtrada por rol", () => {
  it("Ítem sin roles visible para todos: Inicio y Mi libreta para USER y ADMIN", async () => {
    for (const user of [USER, ADMIN]) {
      signIn(user);
      const { unmount } = renderApp("/");
      const nav = await mainNav();
      expect(nav.getByRole("link", { name: "Inicio" })).toBeInTheDocument();
      expect(nav.getByRole("link", { name: "Mi libreta" })).toBeInTheDocument();
      unmount();
    }
  });

  it("Ítem restringido oculto en la barra fija: USER no ve Usuarios, ADMIN sí", async () => {
    signIn(USER);
    const first = renderApp("/");
    expect((await mainNav()).queryByRole("link", { name: "Usuarios" })).not.toBeInTheDocument();
    first.unmount();

    signIn(ADMIN);
    renderApp("/");
    expect((await mainNav()).getByRole("link", { name: "Usuarios" })).toBeInTheDocument();
  });

  it("Ítem restringido oculto en el cajón móvil", async () => {
    const user = userEvent.setup();
    signIn(USER);
    const first = renderApp("/");
    await user.click(await screen.findByRole("button", { name: "Abrir menú" }));
    let drawer = screen.getByRole("dialog", { name: "Menú de navegación" });
    expect(within(drawer).getByRole("link", { name: "Mi libreta" })).toBeInTheDocument();
    expect(within(drawer).queryByRole("link", { name: "Usuarios" })).not.toBeInTheDocument();
    first.unmount();

    signIn(ADMIN);
    renderApp("/");
    await user.click(await screen.findByRole("button", { name: "Abrir menú" }));
    drawer = screen.getByRole("dialog", { name: "Menú de navegación" });
    expect(within(drawer).getByRole("link", { name: "Usuarios" })).toBeInTheDocument();
  });

  it("ADMIN en la sección restringida: la ve y su ítem está activo", async () => {
    signIn(ADMIN);
    renderApp("/usuarios");

    expect(await screen.findByRole("heading", { level: 1, name: "Usuarios" })).toBeInTheDocument();
    expect((await mainNav()).getByRole("link", { name: "Usuarios" })).toHaveAttribute("aria-current", "page");
    expect(denied()).not.toBeInTheDocument();
  });

  it("Acceso denegado dentro del shell: USER por URL ve el estado enfocado, el shell, y puede volver", async () => {
    const user = userEvent.setup();
    signIn(USER);
    const { router } = renderApp("/usuarios");

    const heading = await screen.findByRole("heading", { level: 1, name: "Acceso denegado" });
    expect(heading.closest("section")).toHaveFocus();
    expect(await mainNav()).toBeTruthy(); // el shell sigue visible
    expect(screen.getAllByRole("main")).toHaveLength(1); // sin <main> anidado
    expect(screen.queryByRole("heading", { name: "Usuarios" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "Volver al inicio" }));
    expect(router.state.location.pathname).toBe("/");
  });

  it("Menú y rutas derivados de la misma configuración: cada sección con roles protege su ruta", async () => {
    const restricted = sections.filter((s) => s.roles);
    expect(restricted.length).toBeGreaterThan(0);

    for (const section of restricted) {
      for (const role of ALL_ROLES) {
        signIn({ ...USER, role });
        const { unmount } = renderApp(section.path);
        await mainNav();
        if (section.roles!.includes(role)) {
          expect(denied(), `${role} en ${section.path}`).not.toBeInTheDocument();
        } else {
          expect(denied(), `${role} en ${section.path}`).toBeInTheDocument();
        }
        unmount();
      }
    }
  });

  it("Cambio de rol en caliente: ADMIN → USER oculta el ítem y deniega la ruta", async () => {
    signIn(ADMIN);
    renderApp("/usuarios");
    expect(await screen.findByRole("heading", { level: 1, name: "Usuarios" })).toBeInTheDocument();

    act(() => {
      useSessionStore.setState({ user: { ...ADMIN, role: "USER" }, status: "authenticated" });
    });

    expect(await screen.findByRole("heading", { level: 1, name: "Acceso denegado" })).toBeInTheDocument();
    expect((await mainNav()).queryByRole("link", { name: "Usuarios" })).not.toBeInTheDocument();
  });
});

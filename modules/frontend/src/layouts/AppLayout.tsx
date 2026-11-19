import { useCallback, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useLogout } from "@/modules/auth/hooks/useAuth";
import { Header } from "@/modules/core/components/shell/Header";
import { MobileNavDrawer } from "@/modules/core/components/shell/MobileNavDrawer";
import { Sidebar } from "@/modules/core/components/shell/Sidebar";
import { SharedDeviceLogoutDialog } from "@/modules/records/components/SharedDeviceLogoutDialog";
import { wipeNotebook } from "@/modules/records/notebook/notebookActions";
import { isSharedDevice } from "@/modules/records/notebook/notebookMarkers";
import { useInactivityWipe } from "@/modules/records/notebook/useInactivityWipe";
import { RECORD_EDITOR_ROLES } from "@/modules/core/config/sections";
import { PATHS } from "@/routes/paths";
import { useSessionStore } from "@/store/useSessionStore";
import { useSidebarStore } from "@/store/useSidebarStore";

/**
 * Shell de la zona privada (anidado bajo `RequireAuth`): sidebar + cabecera +
 * contenido. Conecta la sesión y el logout de `modules/auth` con los componentes
 * de `core`, que no pueden depender de otros módulos.
 */
export function AppLayout() {
  const user = useSessionStore((s) => s.user);
  const logout = useLogout();
  const navigate = useNavigate();
  const [sharedLogout, setSharedLogout] = useState(false);
  const hasNotebook = user !== null && RECORD_EDITOR_ROLES.includes(user.role);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const collapsed = useSidebarStore((s) => s.collapsed);
  const toggleSidebar = useSidebarStore((s) => s.toggle);

  // Equipo compartido: tras 15 minutos sin actividad (de cualquier pestaña) se borra la libreta y se cierra la sesión.
  useInactivityWipe(hasNotebook, () => {
    if (user) void wipeNotebook(user.id).finally(() => logout.mutate());
  });

  // RequireAuth garantiza la sesión; esto solo satisface el tipo.
  if (!user) return null;

  // En un equipo compartido se ofrece exportar antes de borrar la libreta; en uno propio se conserva.
  const onLogout = () => (hasNotebook && isSharedDevice() ? setSharedLogout(true) : logout.mutate());
  const confirmSharedLogout = () => {
    setSharedLogout(false);
    void wipeNotebook(user.id).finally(() => logout.mutate());
  };

  return (
    // Marco de la app (barra + cabecera + contenido) con máximo de 1920 px, centrado: en pantallas
    // muy anchas la barra viaja con el contenido y fuera del marco se ve el fondo.
    <div className="min-h-screen bg-muted/40">
      <div data-app-frame className="mx-auto flex min-h-screen w-full max-w-[1920px] bg-background min-[1920px]:border-x min-[1920px]:border-border">
        <Sidebar
          variant="rail"
          role={user.role}
          onLogout={onLogout}
          isLoggingOut={logout.isPending}
          collapsed={collapsed}
          onToggleCollapsed={toggleSidebar}
          className="sticky top-0 hidden h-screen shrink-0 sm:flex"
        />
        {menuOpen ? (
          <MobileNavDrawer role={user.role} onClose={closeMenu} onLogout={onLogout} isLoggingOut={logout.isPending} />
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <Header user={user} onMenuClick={() => setMenuOpen((open) => !open)} menuOpen={menuOpen} />
          <main className="flex-1 p-4 sm:p-6 lg:p-8">
            {/* Ancho máximo centrado: en pantallas muy anchas el contenido no se estira (1536 px). */}
            <div className="mx-auto w-full max-w-screen-2xl">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
      <SharedDeviceLogoutDialog
        open={sharedLogout}
        onCancel={() => setSharedLogout(false)}
        onExport={() => {
          setSharedLogout(false);
          navigate(PATHS.NOTEBOOK);
        }}
        onConfirm={confirmSharedLogout}
      />
    </div>
  );
}

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

/**
 * La preferencia guardada manda, no la clase de <html>: la vista de impresión quita `dark` mientras está
 * abierta y lo restaura al salir, pero el botón del encabezado se monta antes de esa restauración (leer la
 * clase aquí lo dejaba en claro y guardaba "light").
 */
function getInitialDark(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const saved = localStorage.getItem("theme");
    if (saved === "dark" || saved === "light") return saved === "dark";
  } catch {
    /* almacenamiento no disponible: se usa el sistema */
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? document.documentElement.classList.contains("dark");
}

/** Alterna el modo claro/oscuro (clase `dark` en <html>) y persiste la preferencia. */
export function ThemeToggle() {
  const [dark, setDark] = useState(getInitialDark);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    try {
      localStorage.setItem("theme", dark ? "dark" : "light");
    } catch {
      /* almacenamiento no disponible: se ignora */
    }
  }, [dark]);

  return (
    <button
      type="button"
      onClick={() => setDark((d) => !d)}
      aria-label={dark ? "Activar modo claro" : "Activar modo oscuro"}
      className="inline-flex size-9 items-center justify-center rounded-md border border-border bg-background text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}

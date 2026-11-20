import { useEffect, useRef } from "react";
import { isSharedDevice } from "./notebookMarkers";
import { broadcastActivity, onRemoteActivity } from "./notebookLocks";

/** Plazo de inactividad de un equipo compartido (design D8). */
export const INACTIVITY_MS = 15 * 60 * 1000;

const ACTIVITY_EVENTS = ["pointerdown", "mousemove", "keydown", "touchstart", "scroll"] as const;
/** Cuántas veces como máximo se avisa a las otras pestañas de la actividad. */
const BROADCAST_EVERY_MS = 5_000;

/**
 * En un equipo marcado como compartido, tras 15 minutos sin actividad llama a `onExpire` (que borra la
 * libreta y cierra la sesión). La actividad de CUALQUIER pestaña reinicia el plazo en todas
 * (`BroadcastChannel`). El ajuste se lee en cada vencimiento: si dejó de ser compartido, no hace nada.
 * El borrado espera a que otra operación de la libreta (exportar, importar, imprimir) termine: lo hace
 * `onExpire` bajo el bloqueo de la libreta.
 */
export function useInactivityWipe(active: boolean, onExpire: () => void, timeoutMs = INACTIVITY_MS) {
  const expire = useRef(onExpire);
  // La última función recibida se guarda fuera del render (el efecto del temporizador no se reinicia por ella).
  useEffect(() => {
    expire.current = onExpire;
  });

  useEffect(() => {
    if (!active) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastBroadcast = 0;

    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (isSharedDevice()) expire.current();
      }, timeoutMs);
    };
    const onActivity = () => {
      arm();
      const now = Date.now();
      if (now - lastBroadcast >= BROADCAST_EVERY_MS) {
        lastBroadcast = now;
        broadcastActivity();
      }
    };

    arm();
    ACTIVITY_EVENTS.forEach((name) => window.addEventListener(name, onActivity, { passive: true }));
    const stopRemote = onRemoteActivity(arm);
    return () => {
      clearTimeout(timer);
      ACTIVITY_EVENTS.forEach((name) => window.removeEventListener(name, onActivity));
      stopRemote();
    };
  }, [active, timeoutMs]);
}

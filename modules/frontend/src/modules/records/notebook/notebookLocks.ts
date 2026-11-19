/**
 * Coordinación entre pestañas (design D8): exportar, importar, imprimir y borrar la libreta toman un
 * bloqueo exclusivo (Web Locks) para que, por ejemplo, el borrado por inactividad espere a que otra
 * pestaña termine de exportar y nunca quede un archivo parcial. Sin Web Locks las operaciones de esta
 * pestaña se encadenan; entre pestañas la actividad se comparte con `BroadcastChannel` (si existe).
 */
const LOCK_NAME = "hsfacop-notebook";
let chain: Promise<unknown> = Promise.resolve();

/** Ejecuta `work` con el bloqueo de la libreta; si otra operación lo tiene, espera su turno. */
export async function withNotebookLock<T>(work: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  if (locks?.request) {
    return locks.request(LOCK_NAME, { mode: "exclusive" }, () => work());
  }
  const run = chain.then(work, work);
  chain = run.catch(() => undefined);
  return run;
}

const CHANNEL = "hsfacop-notebook-activity";

/** Avisa a las demás pestañas de que hubo actividad (reinicia el plazo de inactividad en todas). */
export function broadcastActivity(): void {
  try {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(CHANNEL);
    channel.postMessage("activity");
    channel.close();
  } catch {
    /* sin BroadcastChannel: cada pestaña cuenta su propia actividad */
  }
}

/** Escucha la actividad de las otras pestañas; devuelve cómo dejar de escuchar. */
export function onRemoteActivity(listener: () => void): () => void {
  try {
    if (typeof BroadcastChannel === "undefined") return () => undefined;
    const channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = () => listener();
    return () => channel.close();
  } catch {
    return () => undefined;
  }
}

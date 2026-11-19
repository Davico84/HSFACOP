import { notebookEntrySchema, type NotebookEntry } from "./notebookSchema";

/**
 * Envoltorio mínimo de IndexedDB para la libreta local (design D1): base `hsfacop-notebook`, almacén
 * `entries` con clave `[accountId, recordId]`. Sin librerías externas. Cada función abre la base,
 * hace una sola operación y la cierra, para no bloquear una actualización de esquema de otra pestaña.
 * Nada se guarda en otro lugar si algo falla: el error sube con su causa (`NotebookError`).
 */
export const DB_NAME = "hsfacop-notebook";
export const STORE = "entries";
const DB_VERSION = 1;

export type NotebookErrorKind =
  /** El navegador no ofrece IndexedDB, o no lo permite (modo privado de algunos navegadores). */
  | "unavailable"
  /** La cuota del navegador está llena. */
  | "quota"
  /** Otra pestaña tiene abierta una versión anterior de la base y bloquea la actualización. */
  | "blocked"
  | "unknown";

export class NotebookError extends Error {
  readonly kind: NotebookErrorKind;

  constructor(kind: NotebookErrorKind) {
    super(kind);
    this.name = "NotebookError";
    this.kind = kind;
  }
}

/** Mensaje visible de cada causa (sin detalles técnicos ni datos del paciente). */
export function notebookErrorMessage(error: unknown): string {
  const kind = error instanceof NotebookError ? error.kind : "unknown";
  switch (kind) {
    case "unavailable":
      return "La libreta no está disponible en este navegador.";
    case "quota":
      return "No hay espacio en el navegador para guardar la libreta. Libera espacio y vuelve a intentar.";
    case "blocked":
      return "Cierra las otras pestañas y vuelve a intentar.";
    default:
      return "No se pudo guardar la libreta en este navegador.";
  }
}

/** ¿El navegador ofrece IndexedDB? (No garantiza que escribir funcione: modo privado, cuota.) */
export function hasIndexedDb(): boolean {
  try {
    return typeof indexedDB !== "undefined" && indexedDB !== null;
  } catch {
    return false;
  }
}

/** ¿El navegador ofrece la criptografía que pide exportar e importar? Sin HTTPS no hay `crypto.subtle`. */
export function hasWebCrypto(): boolean {
  return typeof crypto !== "undefined" && typeof crypto.subtle !== "undefined" && typeof crypto.getRandomValues === "function";
}

function classify(error: unknown): NotebookError {
  if (error instanceof NotebookError) return error;
  const name = (error as { name?: string } | null)?.name;
  if (name === "QuotaExceededError") return new NotebookError("quota");
  if (name === "SecurityError" || name === "InvalidStateError" || name === "UnknownError") return new NotebookError("unavailable");
  return new NotebookError("unknown");
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!hasIndexedDb()) {
      reject(new NotebookError("unavailable"));
      return;
    }
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (error) {
      reject(classify(error));
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: ["accountId", "recordId"] });
      }
    };
    request.onblocked = () => reject(new NotebookError("blocked"));
    request.onerror = () => reject(classify(request.error));
    request.onsuccess = () => {
      const db = request.result;
      // Si otra pestaña pide actualizar la base, esta conexión se cierra para no bloquearla.
      db.onversionchange = () => db.close();
      resolve(db);
    };
  });
}

async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T> | null): Promise<T | undefined> {
  const db = await open();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = work(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request ? request.result : undefined);
      tx.onerror = () => reject(classify(tx.error));
      tx.onabort = () => reject(classify(tx.error));
    });
  } catch (error) {
    throw classify(error);
  } finally {
    db.close();
  }
}

/** Una entrada, o `null` si no hay o está dañada (se ignora, no se corrige a escondidas). */
export async function getEntry(accountId: number, recordId: number): Promise<NotebookEntry | null> {
  const raw = await run("readonly", (store) => store.get([accountId, recordId]));
  const parsed = notebookEntrySchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** Todas las entradas de una cuenta (otra cuenta del mismo navegador nunca las ve). */
export async function listEntries(accountId: number): Promise<NotebookEntry[]> {
  const raw = await run("readonly", (store) => store.getAll(IDBKeyRange.bound([accountId, 0], [accountId, Number.MAX_SAFE_INTEGER])));
  return (raw ?? []).flatMap((item) => {
    const parsed = notebookEntrySchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

export async function putEntry(entry: NotebookEntry): Promise<void> {
  await run("readwrite", (store) => store.put(entry));
}

/** Guarda varias entradas en una sola transacción: o todas o ninguna (importación atómica). */
export async function putEntries(entries: NotebookEntry[]): Promise<void> {
  if (entries.length === 0) return;
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      for (const entry of entries) store.put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(classify(tx.error));
      tx.onabort = () => reject(classify(tx.error));
    });
  } catch (error) {
    throw classify(error);
  } finally {
    db.close();
  }
}

export async function deleteEntry(accountId: number, recordId: number): Promise<void> {
  await run("readwrite", (store) => store.delete([accountId, recordId]));
}

/** Borra todas las entradas de una cuenta ("Borrar la libreta de este dispositivo"). */
export async function clearAccount(accountId: number): Promise<void> {
  await run("readwrite", (store) => store.delete(IDBKeyRange.bound([accountId, 0], [accountId, Number.MAX_SAFE_INTEGER])));
}

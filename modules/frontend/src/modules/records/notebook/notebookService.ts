import { NotebookError, getEntry, putEntry } from "./notebookDb";
import { NOTEBOOK_SCHEMA_VERSION, notebookEntrySchema, notebookFieldsSchema, type NotebookEntry, type NotebookFields } from "./notebookSchema";

/** Resultado de leer la libreta para una historia: la entrada, o por qué no se usa. */
export type NotebookLookup =
  | { status: "found"; entry: NotebookEntry }
  | { status: "empty" }
  /** La entrada guarda otro número de historia que el servidor devuelve para ese identificador. */
  | { status: "mismatch" }
  | { status: "unavailable"; error: NotebookError };

/**
 * Entrada de la libreta de esta cuenta para una historia. Si la entrada guarda un número de historia
 * distinto del que devuelve el servidor para ese identificador (base restaurada, otro entorno), no se
 * usa: ni se muestra ni se imprime.
 */
export async function lookupEntry(accountId: number, recordId: number, recordNumber: string): Promise<NotebookLookup> {
  try {
    const entry = await getEntry(accountId, recordId);
    if (!entry) return { status: "empty" };
    return entry.recordNumber === recordNumber ? { status: "found", entry } : { status: "mismatch" };
  } catch (error) {
    return { status: "unavailable", error: error instanceof NotebookError ? error : new NotebookError("unknown") };
  }
}

/** Error de validación de la entrada, por campo (el mismo de los formularios). */
export type NotebookFieldErrors = Partial<Record<keyof NotebookFields, string>>;

export function validateFields(fields: NotebookFields): NotebookFieldErrors {
  const parsed = notebookFieldsSchema.safeParse(fields);
  if (parsed.success) return {};
  const errors: NotebookFieldErrors = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path[0] as keyof NotebookFields;
    errors[key] ??= issue.message;
  }
  return errors;
}

export interface SaveEntryInput {
  accountId: number;
  recordId: number;
  recordNumber: string;
  fields: NotebookFields;
  now?: Date;
}

/**
 * Guarda la entrada de la libreta con la revisión siguiente. Valida antes: una entrada inválida no se
 * guarda. Un fallo de IndexedDB sube como `NotebookError` y la entrada no figura como guardada.
 */
export async function saveEntry({ accountId, recordId, recordNumber, fields, now = new Date() }: SaveEntryInput): Promise<NotebookEntry> {
  const normalized = notebookFieldsSchema.parse(fields);
  const previous = await getEntry(accountId, recordId);
  const entry = notebookEntrySchema.parse({
    ...normalized,
    accountId,
    recordId,
    recordNumber,
    revision: (previous?.revision ?? 0) + 1,
    updatedAt: now.toISOString(),
    exportedAt: previous?.exportedAt ?? null,
    schemaVersion: NOTEBOOK_SCHEMA_VERSION,
  });
  await putEntry(entry);
  return entry;
}

/** Marca las entradas como exportadas (alimenta el recordatorio de los 7 días). */
export async function markExported(entries: NotebookEntry[], now = new Date()): Promise<void> {
  await Promise.all(entries.map((entry) => putEntry({ ...entry, exportedAt: now.toISOString() })));
}

/** Pide al navegador almacenamiento persistente (no garantiza nada; Safari puede borrar igual). */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (typeof navigator === "undefined" || !navigator.storage?.persist) return false;
    if (await navigator.storage.persisted?.()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

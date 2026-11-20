import { NotebookError } from "./notebookDb";
import { markHadEntry } from "./notebookMarkers";
import { requestPersistence, updateEntry } from "./notebookService";
import type { NotebookFields } from "./notebookSchema";

/**
 * Lo que se escribe en la libreta mientras la historia aún no existe (no hay identificador al que ligarlo).
 * Vive solo en la memoria de la pestaña —nunca en el servidor ni en otro almacenamiento— y se pasa a la
 * libreta en cuanto la historia se crea. Si se abandona la creación, se descarta.
 */
let pending: { accountId: number; changes: Partial<NotebookFields> } | null = null;

export function stashPending(accountId: number, changes: Partial<NotebookFields>): void {
  pending = { accountId, changes };
}

export function discardPending(): void {
  pending = null;
}

/**
 * Guarda en la libreta lo escrito antes de crear la historia. Devuelve false si no había nada, si no es
 * válido o si falló (en ese caso la historia queda creada y los campos se pueden volver a escribir).
 */
export async function flushPending(accountId: number, recordId: number, recordNumber: string): Promise<boolean> {
  const taken = pending;
  pending = null;
  if (!taken || taken.accountId !== accountId) return false;
  try {
    const result = await updateEntry({ accountId, recordId, recordNumber, changes: taken.changes });
    if (!result.ok) return false;
    markHadEntry(accountId, recordId);
    void requestPersistence();
    return true;
  } catch (failure) {
    if (failure instanceof NotebookError) return false;
    throw failure;
  }
}

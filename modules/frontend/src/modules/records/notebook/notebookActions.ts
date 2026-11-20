import { clearAccount, hasWebCrypto, listEntries } from "./notebookDb";
import { applyMerge, decodeNotebook, exportFileName, exportNotebook, planMerge, type MergeResult } from "./notebookFile";
import { clearMarkers } from "./notebookMarkers";
import { withNotebookLock } from "./notebookLocks";
import { markExported } from "./notebookService";
import { generatePassphrase } from "./passphrase";

/** Resultado de preparar una exportación: la frase (se muestra una sola vez) y el archivo. */
export interface PreparedExport {
  passphrase: string;
  fileName: string;
  fileText: string;
  entryCount: number;
}

/** No hay entradas que exportar. */
export class NothingToExport extends Error {
  constructor() {
    super("nothing-to-export");
    this.name = "NothingToExport";
  }
}

/**
 * Prepara el archivo cifrado con todas las entradas de la cuenta (bajo el bloqueo de la libreta). No
 * marca nada como exportado todavía: se marca cuando el usuario descarga el archivo.
 */
export function prepareExport(accountId: number): Promise<PreparedExport> {
  return withNotebookLock(async () => {
    if (!hasWebCrypto()) throw new Error("no-crypto");
    const entries = await listEntries(accountId);
    if (entries.length === 0) throw new NothingToExport();
    const passphrase = generatePassphrase();
    const fileText = await exportNotebook(entries, accountId, passphrase);
    return { passphrase, fileName: exportFileName(), fileText, entryCount: entries.length };
  });
}

/** Marca como exportadas las entradas de la cuenta (ya se descargó el archivo). */
export function confirmExported(accountId: number): Promise<void> {
  return withNotebookLock(async () => markExported(await listEntries(accountId)));
}

/**
 * Importa un archivo con su frase: valida y descifra fuera de la libreta, y solo si todo es válido
 * combina por revisión y escribe de forma atómica. Cualquier fallo es `ImportError` y no cambia nada.
 */
export function importFile(accountId: number, fileText: string, passphrase: string, ownedRecordIds: ReadonlySet<number>): Promise<MergeResult> {
  return withNotebookLock(async () => {
    const decoded = await decodeNotebook(fileText, passphrase, { accountId, ownedRecordIds });
    const { toWrite, result } = planMerge(await listEntries(accountId), decoded.entries, decoded.foreign);
    await applyMerge(toWrite);
    return result;
  });
}

/** Borra todas las entradas de la cuenta del dispositivo; la historia del servidor no cambia. Espera a que termine otra operación. */
export function wipeNotebook(accountId: number): Promise<void> {
  return withNotebookLock(async () => {
    await clearAccount(accountId);
    clearMarkers(accountId);
  });
}

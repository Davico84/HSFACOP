import { AxiosError } from "axios";
import { confirmNotebookBackup, getLegacyIdentity } from "@/modules/core/services/generated/orthodontic-records";
import type { LegacyIdentityResponse } from "@/modules/core/services/generated/model";
import { getEntry, listEntries } from "./notebookDb";
import { decodeNotebook } from "./notebookFile";
import { EMPTY_NOTEBOOK_FIELDS, fieldsOf, type NotebookEntry, type NotebookFields } from "./notebookSchema";
import { saveEntry } from "./notebookService";

/**
 * Copia de los datos antiguos de una historia a la libreta local (design D10). Hasta la fecha límite el
 * servidor devuelve al autor, y solo a él, nombre, documento, nacimiento, lugar, domicilio, celular y
 * nombres de firma; el autor los pasa a su libreta, exporta un archivo cifrado y la aplicación lo
 * descifra en memoria y comprueba campo por campo: solo entonces se marca la historia como respaldada
 * (una marca sin datos del paciente). Los datos antiguos no se cachean: se piden al hacer la copia.
 */

/** ¿Hay datos antiguos que copiar? No guarda la respuesta: solo si existe. */
export async function legacyCopyAvailable(recordId: number): Promise<boolean> {
  try {
    await getLegacyIdentity(recordId);
    return true;
  } catch {
    return false;
  }
}

/** Los datos antiguos como campos de la libreta; el firmante es el apoderado, o el paciente si no hay. */
export function legacyToFields(data: LegacyIdentityResponse): NotebookFields {
  return {
    ...EMPTY_NOTEBOOK_FIELDS,
    fullName: data.patientName ?? "",
    documentType: data.documentType ?? null,
    documentNumber: data.documentNumber ?? "",
    birthDate: data.birthDate ?? "",
    birthPlace: data.birthPlace ?? "",
    address: data.address ?? "",
    phone: data.phone ?? "",
    signerName: data.guardianName ?? data.patientSignatureName ?? "",
    signerRelationship: data.guardianRelationship ?? "",
  };
}

/** La copia ya no está disponible (otra persona, fecha vencida o historia migrada): el servidor responde 404. */
export class LegacyCopyClosed extends Error {
  constructor() {
    super("legacy-copy-closed");
    this.name = "LegacyCopyClosed";
  }
}

/**
 * Pide los datos antiguos y los guarda en la libreta, sin pisar lo que el autor ya escribió allí (solo
 * se llenan los campos vacíos). Si la historia ya no es suya, o venció la fecha, no guarda nada.
 */
export async function copyToNotebook(accountId: number, recordId: number, recordNumber: string): Promise<NotebookEntry> {
  let data: LegacyIdentityResponse;
  try {
    data = await getLegacyIdentity(recordId);
  } catch (error) {
    if (error instanceof AxiosError && error.response?.status === 404) throw new LegacyCopyClosed();
    throw error;
  }
  const existing = await getEntry(accountId, recordId);
  const local = fieldsOf(existing);
  const legacy = legacyToFields(data);
  const isBlank = (value: string | null) => value === "" || value === null;
  const merged = Object.fromEntries(
    (Object.keys(legacy) as (keyof NotebookFields)[]).map((key) => [key, isBlank(local[key]) ? legacy[key] : local[key]]),
  ) as NotebookFields;
  return saveEntry({ accountId, recordId, recordNumber, fields: merged });
}

/** Mismo contenido, entrada por entrada (la fecha de exportación no cuenta: se marca después). */
function sameEntries(a: NotebookEntry[], b: NotebookEntry[]): boolean {
  const key = (entry: NotebookEntry) => JSON.stringify([entry.accountId, entry.recordId, entry.recordNumber, entry.revision, fieldsOf(entry)]);
  const left = a.map(key).sort();
  const right = b.map(key).sort();
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

/**
 * Descifra en memoria el archivo exportado y comprueba, campo por campo, que coincide con la libreta
 * del dispositivo. `false` si no se puede abrir o no coincide: entonces la historia NO se marca.
 */
export async function verifyExport(accountId: number, fileText: string, passphrase: string): Promise<boolean> {
  try {
    const local = await listEntries(accountId);
    const decoded = await decodeNotebook(fileText, passphrase, {
      accountId,
      ownedRecordIds: new Set(local.map((entry) => entry.recordId)),
    });
    return decoded.foreign === 0 && sameEntries(decoded.entries, local);
  } catch {
    return false;
  }
}

/** Marca la historia como respaldada (idempotente). El servidor no recibe ningún dato del paciente. */
export async function markBackedUp(recordId: number): Promise<"marked" | "closed"> {
  try {
    await confirmNotebookBackup(recordId);
    return "marked";
  } catch (error) {
    if (error instanceof AxiosError && error.response?.status === 404) return "closed";
    throw error;
  }
}

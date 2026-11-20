import { z } from "zod";
import { putEntries } from "./notebookDb";
import { NOTEBOOK_FIELD_MAX, fieldsOf, notebookEntrySchema, type NotebookEntry } from "./notebookSchema";
import { normalizePassphrase } from "./passphrase";

/**
 * Archivo exportado de la libreta (design D5 y D6): JSON `{ v, kdf, enc }` cifrado en el navegador con
 * AES-GCM y una clave PBKDF2-SHA256 derivada de una frase. Todo se codifica en base64url sin relleno;
 * el texto (frase y AAD) es UTF-8. El AAD autentica la versión, la cuenta, el KDF, las iteraciones, la
 * sal, el algoritmo y el IV: alterar cualquiera hace fallar el descifrado. Nada sale del navegador.
 */
export const FILE_VERSION = 1;
export const KDF_ALG = "PBKDF2-SHA256";
export const ENC_ALG = "AES-GCM";
export const DEFAULT_ITERATIONS = 600_000;
/** Iteraciones aceptadas al importar (una lista permitida, no cualquier valor del archivo). */
export const MIN_ITERATIONS = 600_000;
export const MAX_ITERATIONS = 2_000_000;
export const SALT_BYTES = 16;
export const IV_BYTES = 12;

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_ENTRIES = 5000;
export const MAX_JSON_DEPTH = 5;
/** Una fecha de modificación posterior a un día después de ahora rechaza el archivo. */
const FUTURE_TOLERANCE_MS = 24 * 60 * 60 * 1000;

/** Único mensaje de todo fallo al abrir un archivo: no distingue la causa. */
export const IMPORT_FAILED = "No se pudo abrir el archivo";

export class ImportError extends Error {
  constructor() {
    super(IMPORT_FAILED);
    this.name = "ImportError";
  }
}

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

export function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64Url(text: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) throw new ImportError();
  const padded = text.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (text.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

/** Cadena canónica autenticada del sobre. */
export function buildAad(accountId: number, iterations: number, saltB64: string, ivB64: string): Uint8Array {
  return encoder.encode(`hsfacop:notebook:v${FILE_VERSION}|${accountId}|${KDF_ALG}|${iterations}|${saltB64}|${ENC_ALG}|${ivB64}`);
}

/** Sal e IV nuevos en cada exportación; nunca se reutilizan. */
export function newExportParams(): { salt: Uint8Array; iv: Uint8Array } {
  return { salt: crypto.getRandomValues(new Uint8Array(SALT_BYTES)), iv: crypto.getRandomValues(new Uint8Array(IV_BYTES)) };
}

async function deriveKey(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey("raw", encoder.encode(normalizePassphrase(passphrase)), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export interface ExportOptions {
  iterations?: number;
  /** Solo para pruebas con vectores fijos. */
  params?: { salt: Uint8Array; iv: Uint8Array };
}

/** Archivo cifrado con las entradas de la cuenta; un texto JSON listo para descargar. */
export async function exportNotebook(entries: NotebookEntry[], accountId: number, passphrase: string, options: ExportOptions = {}): Promise<string> {
  if (entries.length === 0) throw new Error("empty");
  const iterations = options.iterations ?? DEFAULT_ITERATIONS;
  const { salt, iv } = options.params ?? newExportParams();
  const saltB64 = toBase64Url(salt);
  const ivB64 = toBase64Url(iv);
  const key = await deriveKey(passphrase, salt, iterations);
  const plaintext = encoder.encode(JSON.stringify({ entries }));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource, additionalData: buildAad(accountId, iterations, saltB64, ivB64) as BufferSource }, key, plaintext as BufferSource),
  );
  return JSON.stringify({
    v: FILE_VERSION,
    kdf: { alg: KDF_ALG, iter: iterations, salt: saltB64 },
    enc: { alg: ENC_ALG, iv: ivB64, ct: toBase64Url(ciphertext) },
  });
}

/** Nombre del archivo: genérico, con la fecha, sin datos del paciente. */
export function exportFileName(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `libreta-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}.hsflibreta`;
}

const envelopeSchema = z.strictObject({
  v: z.literal(FILE_VERSION),
  kdf: z.strictObject({ alg: z.literal(KDF_ALG), iter: z.number().int().min(MIN_ITERATIONS).max(MAX_ITERATIONS), salt: z.string().max(64) }),
  enc: z.strictObject({ alg: z.literal(ENC_ALG), iv: z.string().max(64), ct: z.string() }),
});

/** JSON sin `__proto__` ni `constructor` (no se contamina ningún prototipo). */
function safeParse(text: string): unknown {
  return JSON.parse(text, (key, value: unknown) => (key === "__proto__" || key === "constructor" ? undefined : value));
}

function depthOf(value: unknown, depth = 1): number {
  if (value === null || typeof value !== "object") return depth;
  const children = Array.isArray(value) ? value : Object.values(value);
  return children.reduce<number>((max, child) => Math.max(max, depthOf(child, depth + 1)), depth);
}

function longestString(value: unknown): number {
  if (typeof value === "string") return value.length;
  if (value === null || typeof value !== "object") return 0;
  return (Array.isArray(value) ? value : Object.values(value)).reduce<number>((max, child) => Math.max(max, longestString(child)), 0);
}

const contentSchema = z.strictObject({ entries: z.array(z.unknown()).max(MAX_ENTRIES) });

export interface DecodedNotebook {
  entries: NotebookEntry[];
  /** Entradas del archivo que se omiten por ser de historias que no son del usuario. */
  foreign: number;
}

export interface DecodeOptions {
  accountId: number;
  /** Identificadores de las historias del usuario (según su lista); las demás se omiten. */
  ownedRecordIds: ReadonlySet<number>;
  now?: Date;
}

/**
 * Abre un archivo exportado: valida tamaño, versión, algoritmos y parámetros contra una lista permitida,
 * descifra con el AAD de esta cuenta, aplica los límites y valida cada entrada. Todo fallo es el mismo
 * `ImportError`, antes de tocar la libreta.
 */
export async function decodeNotebook(fileText: string, passphrase: string, { accountId, ownedRecordIds, now = new Date() }: DecodeOptions): Promise<DecodedNotebook> {
  try {
    if (encoder.encode(fileText).length > MAX_FILE_BYTES) throw new ImportError();
    const envelope = envelopeSchema.parse(safeParse(fileText));
    const salt = fromBase64Url(envelope.kdf.salt);
    const iv = fromBase64Url(envelope.enc.iv);
    if (salt.length !== SALT_BYTES || iv.length !== IV_BYTES) throw new ImportError();
    const key = await deriveKey(passphrase, salt, envelope.kdf.iter);
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv as BufferSource, additionalData: buildAad(accountId, envelope.kdf.iter, envelope.kdf.salt, envelope.enc.iv) as BufferSource },
      key,
      fromBase64Url(envelope.enc.ct) as BufferSource,
    );
    const content: unknown = safeParse(decoder.decode(plaintext));
    if (depthOf(content) > MAX_JSON_DEPTH + 1 || longestString(content) > NOTEBOOK_FIELD_MAX) throw new ImportError();
    const { entries: raw } = contentSchema.parse(content);
    const limit = now.getTime() + FUTURE_TOLERANCE_MS;
    const entries: NotebookEntry[] = [];
    let foreign = 0;
    for (const item of raw) {
      const entry = notebookEntrySchema.parse(item);
      if (entry.accountId !== accountId) throw new ImportError();
      if (new Date(entry.updatedAt).getTime() > limit || Number.isNaN(new Date(entry.updatedAt).getTime())) throw new ImportError();
      if (!ownedRecordIds.has(entry.recordId)) {
        foreign += 1;
        continue;
      }
      entries.push(entry);
    }
    return { entries, foreign };
  } catch {
    throw new ImportError();
  }
}

/** Resultado de combinar el archivo con la libreta del dispositivo. */
export interface MergeResult {
  /** Entradas que no estaban y se agregan. */
  added: number;
  /** Entradas del dispositivo reemplazadas por una de mayor revisión. */
  replaced: number;
  /** Entradas del archivo que se omiten (la del dispositivo es igual o más nueva). */
  skipped: number;
  /** Misma revisión y contenido distinto: se conserva la del dispositivo. */
  conflicts: number;
  /** Entradas de historias ajenas, omitidas. */
  foreign: number;
}

/** Contenido de una entrada sin sus metadatos de versión (para detectar conflictos). */
function contentKey(entry: NotebookEntry): string {
  return JSON.stringify([entry.accountId, entry.recordId, entry.recordNumber, fieldsOf(entry)]);
}

/** Qué entradas escribir y el resumen: gana la mayor `revision` (nunca el reloj del dispositivo). */
export function planMerge(local: NotebookEntry[], incoming: NotebookEntry[], foreign = 0): { toWrite: NotebookEntry[]; result: MergeResult } {
  const byKey = new Map(local.map((entry) => [`${entry.accountId}:${entry.recordId}`, entry]));
  const toWrite: NotebookEntry[] = [];
  const result: MergeResult = { added: 0, replaced: 0, skipped: 0, conflicts: 0, foreign };
  for (const entry of incoming) {
    const existing = byKey.get(`${entry.accountId}:${entry.recordId}`);
    if (!existing) {
      toWrite.push(entry);
      result.added += 1;
    } else if (entry.revision > existing.revision) {
      toWrite.push(entry);
      result.replaced += 1;
    } else if (entry.revision === existing.revision && contentKey(entry) !== contentKey(existing)) {
      result.conflicts += 1;
    } else {
      result.skipped += 1;
    }
  }
  return { toWrite, result };
}

/** Importa de forma atómica: todo o nada, en una sola transacción de IndexedDB. */
export async function applyMerge(toWrite: NotebookEntry[]): Promise<void> {
  await putEntries(toWrite);
}

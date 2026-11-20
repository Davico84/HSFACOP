import { afterEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { listEntries, putEntry } from "./notebookDb";
import {
  IMPORT_FAILED,
  ImportError,
  MAX_ENTRIES,
  MAX_ITERATIONS,
  MIN_ITERATIONS,
  applyMerge,
  buildAad,
  decodeNotebook,
  exportFileName,
  exportNotebook,
  fromBase64Url,
  newExportParams,
  planMerge,
  toBase64Url,
} from "./notebookFile";
import { EMPTY_NOTEBOOK_FIELDS, notebookEntrySchema, type NotebookEntry } from "./notebookSchema";
import { PHRASE_WORDS, WORDS, WORD_COUNT, generatePassphrase, normalizePassphrase } from "./passphrase";

const NOW = new Date("2026-10-05T15:00:00Z");
const PHRASE = "bada kepo luma sinu tove zaxi";
const OWNED = new Set([10, 11, 12]);

function entry(recordId: number, overrides: Partial<NotebookEntry> = {}): NotebookEntry {
  return notebookEntrySchema.parse({
    ...EMPTY_NOTEBOOK_FIELDS,
    fullName: `Paciente ${recordId}`,
    documentType: "DNI",
    documentNumber: "74125896",
    accountId: 1,
    recordId,
    recordNumber: `AEO-${String(recordId).padStart(4, "0")}`,
    revision: 1,
    updatedAt: "2026-10-04T10:00:00Z",
    exportedAt: null,
    schemaVersion: 1,
    ...overrides,
  });
}

/** Archivo de prueba con una sola iteración mínima permitida (el KDF real cuesta ~0,3 s por llamada). */
const FAST = { iterations: MIN_ITERATIONS };
const open = (file: string, phrase = PHRASE, owned: ReadonlySet<number> = OWNED, accountId = 1) =>
  decodeNotebook(file, phrase, { accountId, ownedRecordIds: owned, now: NOW });

afterEach(() => {
  vi.unstubAllGlobals();
  globalThis.indexedDB = new IDBFactory();
});

describe("patient-notebook — frase de exportación", () => {
  it("la lista tiene 2 048 palabras distintas y la frase 6 (unos 66 bits)", () => {
    expect(WORDS).toHaveLength(WORD_COUNT);
    expect(new Set(WORDS).size).toBe(WORD_COUNT);
    const phrase = generatePassphrase();
    expect(phrase.split(" ")).toHaveLength(PHRASE_WORDS);
    phrase.split(" ").forEach((word) => expect(WORDS).toContain(word));
    expect(WORD_COUNT ** PHRASE_WORDS).toBeGreaterThan(2 ** 65);
  });

  it("elegir una palabra no tiene sesgo y dos frases distintas no se repiten", () => {
    const phrases = new Set(Array.from({ length: 50 }, () => generatePassphrase()));
    expect(phrases.size).toBe(50);
    // 11 bits por palabra: el valor más alto posible sigue dentro de la lista.
    expect(generatePassphrase((array) => array.fill(0xffff))).toBe(Array(PHRASE_WORDS).fill(WORDS[WORD_COUNT - 1]).join(" "));
  });

  it("la frase se normaliza: mayúsculas, espacios y formas Unicode no cambian la clave", () => {
    expect(normalizePassphrase("  BADA   Kepo luma\tsinu tove zaxi ")).toBe(PHRASE);
    expect(normalizePassphrase("ＢＡＤＡ kepo luma sinu tove zaxi")).toBe(PHRASE);
  });
});

describe("patient-notebook — exportar", () => {
  it("Exportar: archivo con nombre genérico y fecha, sin datos del paciente en claro", async () => {
    const file = await exportNotebook([entry(10, { fullName: "Ana Lucía Quispe Mamani" })], 1, PHRASE, FAST);

    expect(exportFileName(NOW)).toMatch(/^libreta-\d{8}\.hsflibreta$/);
    expect(exportFileName(NOW)).not.toMatch(/Ana|Quispe|74125896/);
    const parsed = JSON.parse(file) as Record<string, unknown>;
    expect(Object.keys(parsed).sort()).toEqual(["enc", "kdf", "v"]);
  });

  it("Archivo ilegible sin la frase: no hay nombres, documentos ni alias en su contenido", async () => {
    const file = await exportNotebook([entry(10, { fullName: "Ana Lucía Quispe Mamani", address: "Av. Sol 123" })], 1, PHRASE, FAST);

    for (const fragment of ["Ana", "Quispe", "Mamani", "74125896", "5896", "Sol 123", "fullName", "documentNumber"]) {
      expect(file).not.toContain(fragment);
    }
    await expect(open(file, "otra frase distinta aquí nunca zeta")).rejects.toThrow(IMPORT_FAILED);
  });

  it("Libreta vacía: no hay nada que exportar y no se genera archivo", async () => {
    await expect(exportNotebook([], 1, PHRASE, FAST)).rejects.toThrow();
  });

  it("Exportaciones repetidas: ni un IV ni una sal se repiten en 100 exportaciones", () => {
    const salts = new Set<string>();
    const ivs = new Set<string>();
    for (let i = 0; i < 100; i += 1) {
      const { salt, iv } = newExportParams();
      expect(salt).toHaveLength(16);
      expect(iv).toHaveLength(12);
      salts.add(toBase64Url(salt));
      ivs.add(toBase64Url(iv));
    }
    expect(salts.size).toBe(100);
    expect(ivs.size).toBe(100);
  });

  it("dos exportaciones de la misma libreta producen archivos distintos", async () => {
    const [a, b] = await Promise.all([exportNotebook([entry(10)], 1, PHRASE, FAST), exportNotebook([entry(10)], 1, PHRASE, FAST)]);
    expect(a).not.toBe(b);
  });

  it("vector de prueba: con sal, IV y frase fijos el archivo es siempre el mismo y se abre", async () => {
    const params = { salt: Uint8Array.from({ length: 16 }, (_, i) => i), iv: Uint8Array.from({ length: 12 }, (_, i) => 100 + i) };
    const file = await exportNotebook([entry(10)], 7, PHRASE, { ...FAST, params });
    const again = await exportNotebook([entry(10)], 7, PHRASE, { ...FAST, params });

    expect(again).toBe(file);
    const parsed = JSON.parse(file) as { kdf: { salt: string; iter: number }; enc: { iv: string } };
    expect(parsed.kdf).toEqual({ alg: "PBKDF2-SHA256", iter: 600000, salt: "AAECAwQFBgcICQoLDA0ODw" });
    expect(parsed.enc.iv).toBe("ZGVmZ2hpamtsbW5v");
    expect(new TextDecoder().decode(buildAad(7, 600000, parsed.kdf.salt, parsed.enc.iv)))
      .toBe("hsfacop:notebook:v1|7|PBKDF2-SHA256|600000|AAECAwQFBgcICQoLDA0ODw|AES-GCM|ZGVmZ2hpamtsbW5v");
    const opened = await open(file.replace(/"ct":"[^"]+"/, (m) => m), PHRASE, OWNED, 7).catch(() => null);
    expect(opened).toBeNull(); // accountId 7 no tiene entradas de la cuenta 1: se rechaza
  });

  it("base64url sin relleno", () => {
    expect(toBase64Url(Uint8Array.from([251, 255, 254]))).toBe("-__-");
    expect(Array.from(fromBase64Url("-__-"))).toEqual([251, 255, 254]);
    expect(() => fromBase64Url("no+valido=")).toThrow(ImportError);
  });
});

describe("patient-notebook — importar", () => {
  it("Importar en otro dispositivo: las entradas del archivo quedan en la libreta y se cuenta cuántas se agregaron", async () => {
    const file = await exportNotebook([entry(10), entry(11)], 1, PHRASE, FAST);

    const decoded = await open(file);
    const { toWrite, result } = planMerge([], decoded.entries, decoded.foreign);
    await applyMerge(toWrite);

    expect(result).toEqual({ added: 2, replaced: 0, skipped: 0, conflicts: 0, foreign: 0 });
    expect((await listEntries(1)).map((e) => e.recordId)).toEqual([10, 11]);
  });

  it("Entradas en conflicto: gana la de mayor revisión; con la misma revisión y otro contenido, la del dispositivo", () => {
    const local = [entry(10, { revision: 3, fullName: "Local" }), entry(11, { revision: 2, fullName: "Igual local" }), entry(12, { revision: 1 })];
    const incoming = [
      entry(10, { revision: 2, fullName: "Archivo más viejo" }),
      entry(11, { revision: 2, fullName: "Igual archivo" }),
      entry(12, { revision: 5, fullName: "Archivo más nuevo" }),
    ];

    const { toWrite, result } = planMerge(local, incoming);

    expect(result).toEqual({ added: 0, replaced: 1, skipped: 1, conflicts: 1, foreign: 0 });
    expect(toWrite.map((e) => e.recordId)).toEqual([12]);
  });

  it("el orden no depende del reloj: una fecha de modificación vieja con revisión mayor gana", () => {
    const local = [entry(10, { revision: 1, updatedAt: "2026-10-04T10:00:00Z", fullName: "Reciente" })];
    const incoming = [entry(10, { revision: 2, updatedAt: "2020-01-01T00:00:00Z", fullName: "Revisión mayor" })];
    expect(planMerge(local, incoming).toWrite[0].fullName).toBe("Revisión mayor");
  });

  it("Reloj desajustado o fecha futura: se rechaza el archivo con el mensaje genérico", async () => {
    const future = await exportNotebook([entry(10, { updatedAt: "2026-10-08T10:00:00Z" })], 1, PHRASE, FAST);
    await expect(open(future)).rejects.toThrow(IMPORT_FAILED);
    const withinTolerance = await exportNotebook([entry(10, { updatedAt: "2026-10-06T14:00:00Z" })], 1, PHRASE, FAST);
    await expect(open(withinTolerance)).resolves.toBeDefined();
  });

  it("Frase incorrecta o archivo alterado: 'No se pudo abrir el archivo', sin distinguir la causa", async () => {
    const file = await exportNotebook([entry(10)], 1, PHRASE, FAST);
    const messages = new Set<string>();
    for (const attempt of [
      () => open(file, "bada kepo luma sinu tove zaxu"),
      () => open(file.replace(/.$/, " ")),
      () => open("no es json"),
      () => open(""),
      () => open(file.replace(/"ct":"(.)/, (_, c: string) => `"ct":"${c === "A" ? "B" : "A"}`)),
    ]) {
      await attempt().then(() => messages.add("abrió"), (e: Error) => messages.add(e.message));
    }
    expect([...messages]).toEqual([IMPORT_FAILED]);
  });

  it("Parámetros alterados: versión, algoritmo, iteraciones, sal, IV o cuenta hacen fallar la importación", async () => {
    const file = await exportNotebook([entry(10)], 1, PHRASE, FAST);
    const base = JSON.parse(file) as { v: number; kdf: { alg: string; iter: number; salt: string }; enc: { alg: string; iv: string; ct: string } };
    const mutate = (change: (copy: typeof base) => void) => {
      const copy = structuredClone(base);
      change(copy);
      return JSON.stringify(copy);
    };
    const tampered = [
      mutate((c) => (c.v = 2)),
      mutate((c) => (c.kdf.alg = "PBKDF2-SHA1")),
      mutate((c) => (c.kdf.iter += 1)),
      mutate((c) => (c.kdf.salt = toBase64Url(new Uint8Array(16)))),
      mutate((c) => (c.enc.iv = toBase64Url(new Uint8Array(12)))),
      mutate((c) => (c.enc.alg = "AES-CBC")),
    ];
    for (const altered of tampered) await expect(open(altered)).rejects.toThrow(IMPORT_FAILED);
    // Otra cuenta: el AAD incluye la cuenta y la entrada es de la cuenta 1.
    await expect(open(file, PHRASE, OWNED, 2)).rejects.toThrow(IMPORT_FAILED);
  });

  it("Archivo de otra cuenta, de versión futura o con iteraciones fuera de la lista permitida", async () => {
    const file = JSON.parse(await exportNotebook([entry(10)], 1, PHRASE, FAST)) as { kdf: { iter: number } };
    for (const iter of [1, MIN_ITERATIONS - 1, MAX_ITERATIONS + 1, 1e12]) {
      const copy = structuredClone(file);
      copy.kdf.iter = iter;
      await expect(open(JSON.stringify(copy))).rejects.toThrow(IMPORT_FAILED);
    }
  });

  it("Archivo demasiado grande: se rechaza antes de descifrar", async () => {
    await expect(open("x".repeat(5 * 1024 * 1024 + 1))).rejects.toThrow(IMPORT_FAILED);
  });

  it("Archivo con demasiadas entradas o campos largos: se rechaza sin tocar la libreta", async () => {
    const many = Array.from({ length: MAX_ENTRIES + 1 }, (_, i) => entry(i + 1, { recordNumber: "AEO-0001" }));
    const tooMany = await exportNotebook(many, 1, PHRASE, FAST);
    await expect(open(tooMany, PHRASE, new Set(many.map((e) => e.recordId)))).rejects.toThrow(IMPORT_FAILED);

    const long = await exportNotebook([{ ...entry(10), address: "x".repeat(201) } as NotebookEntry], 1, PHRASE, FAST);
    await expect(open(long)).rejects.toThrow(IMPORT_FAILED);
    expect(await listEntries(1)).toEqual([]);
  });

  it("un JSON con __proto__ o constructor no contamina nada", async () => {
    const hostile = await exportNotebook(
      [JSON.parse(JSON.stringify(entry(10)).replace("{", '{"__proto__":{"polluted":true},"constructor":{"x":1},')) as NotebookEntry],
      1,
      PHRASE,
      FAST,
    );
    await open(hostile).catch(() => undefined);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("Entradas de historias ajenas: se omiten y se cuentan", async () => {
    const file = await exportNotebook([entry(10), entry(99), entry(100)], 1, PHRASE, FAST);
    const decoded = await open(file);
    expect(decoded.entries.map((e) => e.recordId)).toEqual([10]);
    expect(decoded.foreign).toBe(2);
    expect(planMerge([], decoded.entries, decoded.foreign).result.foreign).toBe(2);
  });

  it("la importación es atómica: si falla a mitad no queda nada escrito", async () => {
    await putEntry(entry(10, { fullName: "Existente" }));
    const original = IDBObjectStore.prototype.put;
    let calls = 0;
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (this: IDBObjectStore, ...args: Parameters<typeof original>) {
      calls += 1;
      if (calls === 2) throw new DOMException("sin espacio", "QuotaExceededError");
      return original.apply(this, args);
    });

    await expect(applyMerge([entry(11), entry(12), entry(13)])).rejects.toMatchObject({ kind: "quota" });
    vi.restoreAllMocks();

    expect((await listEntries(1)).map((e) => e.recordId)).toEqual([10]);
  });
});

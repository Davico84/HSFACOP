import { afterEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { NotebookError, clearAccount, deleteEntry, getEntry, hasIndexedDb, hasWebCrypto, listEntries, notebookErrorMessage, putEntries } from "./notebookDb";
import { EMPTY_NOTEBOOK_FIELDS, fieldsOf, isEmptyFields, type NotebookFields } from "./notebookSchema";
import { lookupEntry, requestPersistence, saveEntry, validateFields } from "./notebookService";

const ANA: NotebookFields = {
  ...EMPTY_NOTEBOOK_FIELDS,
  fullName: "Ana Lucía Quispe Mamani",
  documentType: "DNI",
  documentNumber: "74125896",
  birthDate: "2012-05-20",
  birthPlace: "Lima",
  address: "Av. Sol 123",
  phone: "987654321",
};

afterEach(() => {
  vi.unstubAllGlobals();
  globalThis.indexedDB = new IDBFactory();
});

describe("patient-notebook — guardar y leer la libreta local", () => {
  it("Guardar en la libreta: la entrada queda ligada a la cuenta y a la historia", async () => {
    const saved = await saveEntry({ accountId: 1, recordId: 10, recordNumber: "AEO-0015", fields: ANA });

    expect(saved).toMatchObject({ accountId: 1, recordId: 10, recordNumber: "AEO-0015", revision: 1, fullName: ANA.fullName });
    expect(await getEntry(1, 10)).toEqual(saved);
    expect(await getEntry(1, 11)).toBeNull();
  });

  it("cada guardado sube la revisión (el orden nunca depende del reloj)", async () => {
    const base = { accountId: 1, recordId: 10, recordNumber: "AEO-0015" };
    const first = await saveEntry({ ...base, fields: ANA, now: new Date("2026-10-05T10:00:00Z") });
    // Un reloj desajustado hacia atrás no cambia el orden.
    const second = await saveEntry({ ...base, fields: { ...ANA, phone: "912345678" }, now: new Date("2020-01-01T00:00:00Z") });

    expect([first.revision, second.revision]).toEqual([1, 2]);
    expect((await getEntry(1, 10))?.phone).toBe("912345678");
  });

  it("Documento con formato incorrecto: error junto al campo y no se guarda", async () => {
    expect(validateFields({ ...ANA, documentType: "DNI", documentNumber: "7412589" }).documentNumber).toBe("El DNI debe tener 8 dígitos.");
    expect(validateFields({ ...ANA, documentType: "FOREIGNER_CARD", documentNumber: "00123456A" }).documentNumber)
      .toBe("El carné de extranjería debe tener 9 dígitos.");
    expect(validateFields({ ...ANA, documentType: "PASSPORT", documentNumber: "12345" }).documentNumber)
      .toBe("El pasaporte debe tener entre 6 y 12 dígitos.");
    expect(validateFields({ ...ANA, documentType: null, documentNumber: "74125896" }).documentType).toBe("Indica el tipo de documento.");
    expect(validateFields({ ...ANA, documentType: "DNI", documentNumber: "" }).documentNumber).toBe("Indica el número del documento.");

    await expect(saveEntry({ accountId: 1, recordId: 10, recordNumber: "AEO-0015", fields: { ...ANA, documentNumber: "7412589" } })).rejects.toThrow();
    expect(await getEntry(1, 10)).toBeNull();
  });

  it("documentos válidos por tipo y datos opcionales", async () => {
    expect(validateFields(ANA)).toEqual({});
    expect(validateFields({ ...ANA, documentType: "FOREIGNER_CARD", documentNumber: "001234567" })).toEqual({});
    expect(validateFields({ ...ANA, documentType: "PASSPORT", documentNumber: "12345678" })).toEqual({});
    expect(validateFields(EMPTY_NOTEBOOK_FIELDS)).toEqual({});
    expect(isEmptyFields(EMPTY_NOTEBOOK_FIELDS)).toBe(true);
    expect(isEmptyFields(ANA)).toBe(false);
  });

  it("un campo de más de 200 caracteres se rechaza", () => {
    expect(validateFields({ ...ANA, address: "x".repeat(201) }).address).toBe("Máximo 200 caracteres.");
    expect(validateFields({ ...ANA, address: "x".repeat(200) })).toEqual({});
  });

  it("Otra cuenta en el mismo dispositivo: no ve ni lista las entradas de la primera", async () => {
    await saveEntry({ accountId: 1, recordId: 10, recordNumber: "AEO-0015", fields: ANA });
    await saveEntry({ accountId: 2, recordId: 20, recordNumber: "AEO-0016", fields: { ...ANA, fullName: "Rosa Díaz" } });

    expect(await getEntry(2, 10)).toBeNull();
    expect((await listEntries(2)).map((e) => e.recordId)).toEqual([20]);
    expect((await listEntries(1)).map((e) => e.recordId)).toEqual([10]);

    await clearAccount(1);
    expect(await listEntries(1)).toEqual([]);
    expect(await listEntries(2)).toHaveLength(1);
  });

  it("borrar una entrada y guardar varias en una sola transacción", async () => {
    const a = await saveEntry({ accountId: 1, recordId: 10, recordNumber: "AEO-0015", fields: ANA });
    await putEntries([{ ...a, recordId: 11, recordNumber: "AEO-0016" }, { ...a, recordId: 12, recordNumber: "AEO-0017" }]);
    expect(await listEntries(1)).toHaveLength(3);
    await deleteEntry(1, 11);
    expect((await listEntries(1)).map((e) => e.recordId)).toEqual([10, 12]);
  });

  it("los campos de una entrada y los de una historia sin entrada", async () => {
    const saved = await saveEntry({ accountId: 1, recordId: 10, recordNumber: "AEO-0015", fields: ANA });
    expect(fieldsOf(saved)).toEqual(ANA);
    expect(fieldsOf(null)).toEqual(EMPTY_NOTEBOOK_FIELDS);
  });
});

describe("patient-notebook — entrada de otra historia con el mismo identificador", () => {
  it("si el número no coincide con el que devuelve el servidor, no se usa", async () => {
    await saveEntry({ accountId: 1, recordId: 10, recordNumber: "AEO-0015", fields: ANA });

    expect((await lookupEntry(1, 10, "AEO-0015")).status).toBe("found");
    expect((await lookupEntry(1, 10, "AEO-0031")).status).toBe("mismatch");
    expect((await lookupEntry(1, 99, "AEO-0015")).status).toBe("empty");
  });

  it("una entrada dañada en la base se ignora", async () => {
    await saveEntry({ accountId: 1, recordId: 10, recordNumber: "AEO-0015", fields: ANA });
    const db = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open("hsfacop-notebook", 1);
      request.onsuccess = () => resolve(request.result);
    });
    await new Promise<void>((resolve) => {
      const tx = db.transaction("entries", "readwrite");
      tx.objectStore("entries").put({ accountId: 1, recordId: 10, fullName: 42 });
      tx.oncomplete = () => resolve();
    });
    db.close();

    expect(await getEntry(1, 10)).toBeNull();
    expect(await listEntries(1)).toEqual([]);
  });
});

describe("patient-notebook — libreta no disponible en el navegador", () => {
  it("Sin IndexedDB: se avisa y nada se guarda en otro lugar", async () => {
    vi.stubGlobal("indexedDB", undefined);

    expect(hasIndexedDb()).toBe(false);
    const lookup = await lookupEntry(1, 10, "AEO-0015");
    expect(lookup.status).toBe("unavailable");
    await expect(saveEntry({ accountId: 1, recordId: 10, recordNumber: "AEO-0015", fields: ANA })).rejects.toMatchObject({ kind: "unavailable" });
    expect(notebookErrorMessage(new NotebookError("unavailable"))).toBe("La libreta no está disponible en este navegador.");
  });

  it("Escritura que falla por cuota: error visible y la entrada no figura como guardada", async () => {
    await saveEntry({ accountId: 1, recordId: 10, recordNumber: "AEO-0015", fields: ANA });
    // Simula QuotaExceededError al escribir.
    const proto = IDBObjectStore.prototype;
    const put = vi.spyOn(proto, "put").mockImplementation(() => {
      throw new DOMException("sin espacio", "QuotaExceededError");
    });

    await expect(saveEntry({ accountId: 1, recordId: 10, recordNumber: "AEO-0015", fields: { ...ANA, phone: "900000000" } }))
      .rejects.toMatchObject({ kind: "quota" });
    put.mockRestore();

    expect((await getEntry(1, 10))?.phone).toBe("987654321");
    expect(notebookErrorMessage(new NotebookError("quota"))).toMatch(/espacio/);
  });

  it("Actualización bloqueada por otra pestaña: pide cerrarlas", async () => {
    // Otra pestaña con una versión anterior abierta que no se cierra al pedir la actualización.
    await new Promise<void>((resolve) => {
      const old = indexedDB.open("hsfacop-notebook", 1);
      old.onupgradeneeded = () => old.result.createObjectStore("entries", { keyPath: ["accountId", "recordId"] });
      old.onsuccess = () => {
        old.result.onversionchange = () => undefined; // no cierra: bloquea
        resolve();
      };
    });
    // Una versión nueva del código pediría subir la versión de la base: se simula abriendo la v2.
    const blocked = await new Promise<string>((resolve) => {
      const request = indexedDB.open("hsfacop-notebook", 2);
      request.onblocked = () => resolve("blocked");
      request.onsuccess = () => resolve("opened");
    });
    expect(blocked).toBe("blocked");
    expect(notebookErrorMessage(new NotebookError("blocked"))).toBe("Cierra las otras pestañas y vuelve a intentar.");
  });

  it("Sin criptografía del navegador (sin HTTPS): se detecta para deshabilitar exportar e importar", () => {
    expect(hasWebCrypto()).toBe(true);
    vi.stubGlobal("crypto", { getRandomValues: undefined, subtle: undefined });
    expect(hasWebCrypto()).toBe(false);
  });

  it("el almacenamiento persistente denegado o no soportado no es un error", async () => {
    vi.stubGlobal("navigator", { storage: { persisted: async () => false, persist: async () => false } });
    expect(await requestPersistence()).toBe(false);
    vi.stubGlobal("navigator", { storage: { persisted: async () => false, persist: async () => true } });
    expect(await requestPersistence()).toBe(true);
    vi.stubGlobal("navigator", {});
    expect(await requestPersistence()).toBe(false);
  });
});

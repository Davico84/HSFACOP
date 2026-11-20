import { describe, expect, it } from "vitest";
import { getEntry } from "./notebookDb";
import { discardPending, flushPending, stashPending } from "./notebookPending";

describe("patient-notebook — datos escritos antes de crear la historia", () => {
  it("Escribir antes de crear la historia: al crearla pasan a la libreta de este dispositivo", async () => {
    stashPending(1, { fullName: "Ana Lucía Quispe Mamani", address: "Av. Sol 123" });
    expect(await flushPending(1, 10, "AEO-0010")).toBe(true);
    const entry = await getEntry(1, 10);
    expect(entry).toMatchObject({ fullName: "Ana Lucía Quispe Mamani", address: "Av. Sol 123", recordNumber: "AEO-0010", revision: 1 });
  });

  it("se toma una sola vez y no pasa a otra historia", async () => {
    stashPending(1, { fullName: "Ana" });
    await flushPending(1, 10, "AEO-0010");
    expect(await flushPending(1, 11, "AEO-0011")).toBe(false);
    expect(await getEntry(1, 11)).toBeNull();
  });

  it("si se abandona la creación se descarta, y lo de otra cuenta no se usa", async () => {
    stashPending(1, { fullName: "Ana" });
    discardPending();
    expect(await flushPending(1, 12, "AEO-0012")).toBe(false);
    stashPending(2, { fullName: "Otra cuenta" });
    expect(await flushPending(1, 13, "AEO-0013")).toBe(false);
    expect(await getEntry(1, 13)).toBeNull();
  });

  it("lo inválido no se guarda", async () => {
    stashPending(1, { documentType: "DNI", documentNumber: "12" });
    expect(await flushPending(1, 14, "AEO-0014")).toBe(false);
    expect(await getEntry(1, 14)).toBeNull();
  });
});

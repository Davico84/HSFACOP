import { describe, expect, it } from "vitest";
import { expirySchema } from "./expiry";

describe("expirySchema", () => {
  it("acepta una fecha civil válida, también pasada", () => {
    expect(expirySchema.safeParse({ expiresOn: "2027-12-31" }).success).toBe(true);
    expect(expirySchema.safeParse({ expiresOn: "2020-01-01" }).success).toBe(true);
  });

  it("rechaza vacío y fechas inexistentes", () => {
    expect(expirySchema.safeParse({ expiresOn: "" }).success).toBe(false);
    expect(expirySchema.safeParse({ expiresOn: "2027-02-30" }).success).toBe(false);
  });
});

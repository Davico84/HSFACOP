import { describe, expect, it } from "vitest";
import { parseExpiryFilter, toApiExpiry } from "./expiry";

describe("filtro de vencimiento", () => {
  it("reconoce los valores de la URL y descarta el resto", () => {
    expect(parseExpiryFilter("por-vencer")).toBe("por-vencer");
    expect(parseExpiryFilter("vencidas")).toBe("vencidas");
    expect(parseExpiryFilter("otro")).toBeNull();
    expect(parseExpiryFilter(null)).toBeNull();
  });

  it("lo traduce al parámetro del contrato", () => {
    expect(toApiExpiry("por-vencer")).toBe("SOON");
    expect(toApiExpiry("vencidas")).toBe("EXPIRED");
    expect(toApiExpiry(null)).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";
import { formatCivilDate } from "./civilDate";

describe("formatCivilDate", () => {
  it("da día/mes/año sin corrimiento de zona horaria", () => {
    expect(formatCivilDate("2027-11-24")).toBe("24/11/2027");
    expect(formatCivilDate("2026-01-01")).toBe("01/01/2026");
  });
});

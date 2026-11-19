import { describe, expect, it } from "vitest";
import { isMinor } from "./age";
import { formatTeeth, isValidFdi } from "./fdi";
import { formatAge, formatDate } from "./recordDisplay";
import { toFormValues, toUpdateRequest } from "./recordForm";
import { recordResponse } from "../test/fixtures";

describe("orthodontic-records — edad escrita", () => {
  it("menor de edad solo si la edad se conoce y es < 18", () => {
    expect(isMinor(0)).toBe(true);
    expect(isMinor(17)).toBe(true);
    expect(isMinor(18)).toBe(false);
    expect(isMinor(99)).toBe(false);
    expect(isMinor(null)).toBe(false);
    expect(isMinor(undefined)).toBe(false);
  });
});

describe("orthodontic-records — notación FDI", () => {
  it("permanentes 11–48 y temporales 51–85", () => {
    expect([11, 18, 48, 51, 55, 85].every((t) => isValidFdi(t))).toBe(true);
    expect([10, 19, 49, 50, 56, 86, 91].some((t) => isValidFdi(t))).toBe(false);
  });

  it("anteriores: solo incisivos y caninos", () => {
    expect(isValidFdi(13, true)).toBe(true);
    expect(isValidFdi(14, true)).toBe(false);
  });

  it("se imprimen ordenadas", () => {
    expect(formatTeeth([26, 13, 55])).toBe("13, 26, 55");
    expect(formatTeeth(null)).toBe("");
  });
});

describe("orthodontic-records — presentación", () => {
  it("fechas y edad", () => {
    expect(formatDate("2026-05-19")).toBe("19/05/2026");
    expect(formatAge(13)).toBe("13 años");
    expect(formatAge(null)).toBe("");
  });
});

describe("orthodontic-records — conversión del formulario", () => {
  it("todos los campos existen desde el inicio (vacíos) y lo vacío no se envía", () => {
    const values = toFormValues(recordResponse({ treatingDentist: "Av. Ejército 512" }));
    expect(values.patientAge).toBeNull();
    expect(values.content.facial.facialType).toBeNull();
    expect(values.content.diagnosis.problemList).toEqual([]);
    const request = toUpdateRequest({ ...values, patientAlias: "  Ana   Q " }, 3);
    expect(request.version).toBe(3);
    expect(request.treatingDentist).toBe("Av. Ejército 512");
    expect("patientAge" in request).toBe(false);
    // El alias se normaliza y la confirmación del formulario nunca viaja al servidor.
    expect(request.patientAlias).toBe("Ana Q");
    expect("aliasConfirmed" in request).toBe(false);
    expect(request.recordNumber).toBe(values.recordNumber);
  });
});

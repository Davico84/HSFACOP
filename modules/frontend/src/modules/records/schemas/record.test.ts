import { describe, expect, it } from "vitest";
import { recordFormSchema, type RecordFormValues } from "./record";
import { emptyRecordValues } from "../utils/recordForm";
import { aliasViolation } from "../utils/alias";

function values(overrides: Partial<RecordFormValues> = {}, content: Record<string, unknown> = {}): RecordFormValues {
  const base = emptyRecordValues("Dra. Torres");
  return {
    ...base,
    recordNumber: "AEO-0015",
    patientAlias: "Ana",
    ...overrides,
    content: { ...base.content, ...content } as RecordFormValues["content"],
  };
}

function errorsOf(input: RecordFormValues): Record<string, string> {
  const result = recordFormSchema.safeParse(input);
  if (result.success) return {};
  return Object.fromEntries(result.error.issues.map((i) => [i.path.join("."), i.message]));
}

describe("orthodontic-records — schema del formulario (paridad con el backend)", () => {
  it("bastan el número y el nombre del paciente (borrador)", () => {
    expect(errorsOf(values())).toEqual({});
  });

  it("número de historia obligatorio y con el formato AEO-0001", () => {
    expect(errorsOf(values({ recordNumber: "  " }))).toEqual({ recordNumber: "Indica el número de historia." });
    for (const invalid of ["AEO-15", "AEO-00001", "AOC-0015", "aeo-0015"]) {
      expect(errorsOf(values({ recordNumber: invalid }))).toEqual({ recordNumber: "Usa el formato AEO-0001." });
    }
  });

  it("edad de la primera menstruación: 8 a 18 años, no mayor que la edad registrada, solo si aplica", () => {
    const female = { patientSex: "FEMALE" as const, patientAge: 14 };
    const anamnesis = (menarche: "YES" | "NO", menarcheAge: number) => ({
      anamnesis: { ...emptyRecordValues().content.anamnesis, menarche, menarcheAge },
    });
    const path = "content.anamnesis.menarcheAge";
    expect(errorsOf(values(female, anamnesis("YES", 13)))).toEqual({});
    expect(errorsOf(values(female, anamnesis("YES", 7)))).toEqual({ [path]: "Usa una edad entre 8 y 18 años." });
    expect(errorsOf(values(female, anamnesis("YES", 19)))).toEqual({ [path]: "Usa una edad entre 8 y 18 años." });
    expect(errorsOf(values(female, anamnesis("YES", 15)))).toEqual({
      [path]: "La edad de la primera menstruación no puede superar la edad registrada de la paciente.",
    });
    // Sin edad registrada solo se exige el rango.
    expect(errorsOf(values({ patientSex: "FEMALE", patientAge: null }, anamnesis("YES", 18)))).toEqual({});
    // Con "No" o sin sexo femenino la edad no aplica (el servidor la descarta al guardar).
    expect(errorsOf(values(female, anamnesis("NO", 30)))).toEqual({});
    expect(errorsOf(values({ patientSex: "MALE", patientAge: 14 }, anamnesis("YES", 30)))).toEqual({});
  });

  it("menor de 8 años: 'Sí' en la 1ª menstruación es un error; sin edad no se controla", () => {
    const anamnesis = { anamnesis: { ...emptyRecordValues().content.anamnesis, menarche: "YES" as const } };
    expect(errorsOf(values({ patientSex: "FEMALE", patientAge: 7 }, anamnesis))).toEqual({
      "content.anamnesis.menarche": "Antes de los 8 años la primera menstruación no aplica.",
    });
    expect(errorsOf(values({ patientSex: "FEMALE", patientAge: 8 }, anamnesis))).toEqual({});
    expect(errorsOf(values({ patientSex: "FEMALE", patientAge: null }, anamnesis))).toEqual({});
  });

  it("separación interlabial: 0 a 20 mm con un decimal, opcional", () => {
    const facial = (lipSealMm: number | null) => ({
      facial: { ...emptyRecordValues().content.facial, lipSeal: "PRESENT" as const, lipSealMm },
    });
    const path = "content.facial.lipSealMm";
    expect(errorsOf(values({}, facial(2.5)))).toEqual({});
    expect(errorsOf(values({}, facial(null)))).toEqual({});
    expect(errorsOf(values({}, facial(20.5)))).toEqual({ [path]: "Máximo 20 mm." });
    expect(errorsOf(values({}, facial(-1)))).toEqual({ [path]: "Mínimo 0 mm." });
    expect(errorsOf(values({}, facial(2.55)))).toEqual({ [path]: "Máximo un decimal." });
  });

  it("alias vacío o solo espacios: error en el campo", () => {
    expect(errorsOf(values({ patientAlias: "   " }))).toEqual({ patientAlias: "Indica el alias del paciente." });
    expect(errorsOf(values({ patientAlias: null }))).toEqual({ patientAlias: "Indica el alias del paciente." });
  });

  it("alias: más de dos palabras, número largo y caracteres no permitidos", () => {
    expect(errorsOf(values({ patientAlias: "Mateo Quispe Rojas" })).patientAlias).toBe("Usa una o dos palabras, sin apellidos.");
    expect(errorsOf(values({ patientAlias: "Mateo 74125896" })).patientAlias).toBe("No escribas números de documento en el alias.");
    expect(errorsOf(values({ patientAlias: "Ana@" })).patientAlias).toBe("Usa solo letras, números, guion y apóstrofo.");
    expect(errorsOf(values({ patientAlias: "a".repeat(31) })).patientAlias).toBe("El alias admite hasta 30 caracteres.");
    expect(errorsOf(values({ patientAlias: "a".repeat(30) }))).toEqual({});
  });

  it("alias: espacios sobrantes se normalizan y un número corto es válido", () => {
    expect(errorsOf(values({ patientAlias: "  Ana   Q ", aliasConfirmed: true }))).toEqual({});
    expect(errorsOf(values({ patientAlias: "José 12" }))).toEqual({ aliasConfirmed: "Confirma que el alias no es el nombre real del paciente." });
  });

  it("alias de dos palabras o repetido en un texto libre: pide confirmar", () => {
    const confirm = { aliasConfirmed: "Confirma que el alias no es el nombre real del paciente." };
    expect(errorsOf(values({ patientAlias: "Ana Q" }))).toEqual(confirm);
    expect(errorsOf(values({ patientAlias: "Ana Q", aliasConfirmed: true }))).toEqual({});
    const text = { anamnesis: { ...emptyRecordValues().content.anamnesis, chiefComplaint: "Mateo se muerde las uñas" } };
    expect(errorsOf(values({ patientAlias: "Mateo" }, text))).toEqual(confirm);
    expect(errorsOf(values({ patientAlias: "Mateo", aliasConfirmed: true }, text))).toEqual({});
    expect(errorsOf(values({ patientAlias: "Lucas" }, text))).toEqual({});
  });

  it("edad: de 0 a 99, entera y opcional", () => {
    for (const age of [0, 17, 18, 99, null]) expect(errorsOf(values({ patientAge: age }))).toEqual({});
    for (const age of [-1, 100, 12.5]) {
      expect(errorsOf(values({ patientAge: age })).patientAge).toBe("Usa una edad entre 0 y 99 años.");
    }
  });

  it("el alias comparte vectores con el servidor (PatientAliasTest)", () => {
    for (const valid of ["Mateo", "Ana Q", "  Ana    Q  ", "Jean-Luc", "D'Angelo", "María José", "Ana 12", "Ana 12345", "Ａｎａ", "李明", "Ñandú Ç"]) {
      expect(aliasViolation(valid), valid).toBeNull();
    }
    for (const invalid of [null, "   ", "a".repeat(31), "Ana Lucía Quispe", "Ana 123456", "74125896", "Ana!", "Ana_Q", "Ana@", "Ana.", "Ana😀"]) {
      expect(aliasViolation(invalid), String(invalid)).not.toBeNull();
    }
    expect(aliasViolation("a".repeat(30))).toBeNull();
    // 30 y 31 puntos de código: cada letra matemática ocupa 2 unidades UTF-16 y se cuenta como una.
    expect(aliasViolation("𝐚".repeat(30))).toBeNull();
    expect(aliasViolation("𝐚".repeat(31))).not.toBeNull();
  });

  it("texto largo por encima del límite", () => {
    const out = errorsOf(values({}, { anamnesis: { chiefComplaint: "x".repeat(4001) } }));
    expect(out["content.anamnesis.chiefComplaint"]).toBe("Máximo 4000 caracteres.");
  });

  it("porcentaje y milímetros fuera de rango o con más de un decimal", () => {
    expect(errorsOf(values({}, { occlusal: { deepBitePercent: 101 } }))["content.occlusal.deepBitePercent"]).toBeDefined();
    expect(errorsOf(values({}, { occlusal: { overjetMm: 31 } }))["content.occlusal.overjetMm"]).toBeDefined();
    expect(errorsOf(values({}, { occlusal: { openBiteMm: 2.25 } }))["content.occlusal.openBiteMm"]).toBe("Máximo un decimal.");
    expect(errorsOf(values({}, { occlusal: { deepBitePercent: 40, openBiteMm: 3, overjetMm: 5.5 } }))).toEqual({});
  });

  it("línea media desviada exige al menos 0,5 mm", () => {
    const deviated = (mm?: number) => values({}, { occlusal: { midlineLower: { position: "DEVIATED_LEFT", deviationMm: mm } } });
    expect(errorsOf(deviated(0.4))["content.occlusal.midlineLower.deviationMm"]).toBeDefined();
    expect(errorsOf(deviated())["content.occlusal.midlineLower.deviationMm"]).toBeDefined();
    expect(errorsOf(deviated(2))).toEqual({});
    expect(errorsOf(values({}, { occlusal: { midlineUpper: { position: "CENTERED" } } }))).toEqual({});
  });

  it("piezas FDI válidas (anteriores donde corresponde)", () => {
    expect(errorsOf(values({}, { functional: { bruxismTeeth: [13, 26, 55] } }))).toEqual({});
    expect(errorsOf(values({}, { functional: { bruxismTeeth: [16, 49] } }))["content.functional.bruxismTeeth.1"]).toBeDefined();
    expect(errorsOf(values({}, { occlusal: { anteriorCrossbiteTeeth: [14] } }))["content.occlusal.anteriorCrossbiteTeeth.0"]).toBeDefined();
  });

  it("listas: máximo 30 ítems de 500 caracteres", () => {
    const many = Array.from({ length: 31 }, () => "p");
    expect(errorsOf(values({}, { diagnosis: { problemList: many } }))["content.diagnosis.problemList"]).toBeDefined();
    expect(errorsOf(values({}, { diagnosis: { treatmentGoals: ["x".repeat(501)] } }))["content.diagnosis.treatmentGoals.0"]).toBeDefined();
  });
});

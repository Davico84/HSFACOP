/**
 * Edad escrita del paciente (misma regla que `RecordAgeCalculator` del backend): años cumplidos al
 * inicio del tratamiento, de 0 a 99, opcional. La aplicación ya no la calcula: la escribe el
 * tratante.
 */
export const MIN_AGE = 0;
export const MAX_AGE = 99;
export const AGE_RANGE_MESSAGE = "Usa una edad entre 0 y 99 años.";

/** Mayoría de edad: por debajo firma el apoderado. */
export const ADULT_AGE = 18;

/** Sin edad (nula) se trata como adulta. */
export function isMinor(age: number | null | undefined): boolean {
  return age !== null && age !== undefined && age < ADULT_AGE;
}

/** Hoy en ISO local (`yyyy-mm-dd`). */
export function today(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

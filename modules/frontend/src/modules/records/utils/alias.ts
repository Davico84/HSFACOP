/**
 * Reglas del alias del paciente, en paridad con `PatientAlias` del backend (design D2): se
 * normaliza con Unicode NFKC, sin espacios al inicio ni al final y con los espacios repetidos
 * reducidos a uno; de 1 a 30 puntos de código, hasta 2 palabras, solo letras, marcas, dígitos,
 * guion y apóstrofo, y ninguna secuencia de 6 o más dígitos (evita pegar un documento). El servidor
 * valida forma y límites; ni él ni el navegador pueden saber si es un nombre real.
 */

export const ALIAS_MAX_CODE_POINTS = 30;
export const ALIAS_MAX_WORDS = 2;

const ALLOWED = /^[\p{L}\p{M}\p{N}'’-]+(?: [\p{L}\p{M}\p{N}'’-]+)?$/u;
const DIGIT_RUN = /\p{Nd}{6,}/u;

/** NFKC, recortado y con espacios colapsados. */
export function normalizeAlias(alias: string): string {
  return alias.normalize("NFKC").replace(/\s+/g, " ").trim();
}

/** Motivo del primer incumplimiento del alias, o `null` si es válido (mismos mensajes que el servidor). */
export function aliasViolation(alias: string | null | undefined): string | null {
  const value = normalizeAlias(alias ?? "");
  if (value === "") return "Indica el alias del paciente.";
  if ([...value].length > ALIAS_MAX_CODE_POINTS) return "El alias admite hasta 30 caracteres.";
  if (value.split(" ").length > ALIAS_MAX_WORDS) return "Usa una o dos palabras, sin apellidos.";
  if (!ALLOWED.test(value)) return "Usa solo letras, números, guion y apóstrofo.";
  if (DIGIT_RUN.test(value)) return "No escribas números de documento en el alias.";
  return null;
}

/** Minúsculas y sin tildes, para comparar palabras. */
function plain(text: string): string {
  return text.normalize("NFD").replace(/\p{M}+/gu, "").toLowerCase();
}

/** Palabras de al menos 3 letras de un texto, sin tildes ni mayúsculas. */
function words(text: string): string[] {
  return plain(text).split(/[^\p{L}\p{N}]+/u).filter((word) => word.length >= 3);
}

/** Todos los textos de un valor anidado (el contenido clínico), sin números ni fechas de otro tipo. */
function textsOf(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(textsOf);
  if (value && typeof value === "object") return Object.values(value).flatMap(textsOf);
  return [];
}

/**
 * ¿El alias parece un nombre real? Sí si tiene dos palabras o si alguna de sus palabras aparece en
 * un texto libre de la historia. Es solo una ayuda: pide confirmar, no impide guardar.
 */
export function aliasLooksReal(alias: string | null | undefined, content: unknown): boolean {
  const value = normalizeAlias(alias ?? "");
  if (value === "") return false;
  if (value.split(" ").length >= 2) return true;
  const aliasWords = words(value);
  if (aliasWords.length === 0) return false;
  const inTexts = new Set(textsOf(content).flatMap(words));
  return aliasWords.some((word) => inTexts.has(word));
}

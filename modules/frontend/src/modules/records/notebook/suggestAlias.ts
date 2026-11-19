const PARTICLES = new Set(["de", "del", "la", "las", "los", "y", "san", "santa"]);

/**
 * Alias propuesto desde el nombre completo de la libreta (calculado en el navegador, nunca enviado):
 * el nombre de pila más la inicial del primer apellido, sin partículas ("Ana Lucía Quispe" → "Ana L";
 * con un nombre compuesto el alias es solo una propuesta y el usuario lo edita). Una sola palabra se
 * propone tal cual; sin palabras no hay propuesta. Misma regla que la migración de las historias
 * existentes, con signos y secuencias de 6 o más dígitos quitados para que siempre sea un alias válido.
 */
export function suggestAlias(fullName: string): string | null {
  const words = fullName
    .normalize("NFKC")
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{M}\p{N}'’-]/gu, "").replace(/\p{Nd}{6,}/gu, ""))
    .filter((word) => word !== "" && !PARTICLES.has(word.toLowerCase()));
  if (words.length === 0) return null;
  if (words.length === 1) return [...words[0]].slice(0, 30).join("");
  const alias = `${words[0]} ${[...words[1]][0].toUpperCase()}`;
  return [...alias].slice(0, 30).join("").trim();
}

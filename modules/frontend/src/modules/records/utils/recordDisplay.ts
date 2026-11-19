/** `2026-05-19` → `19/05/2026`; vacío si no hay fecha. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/** Fecha y hora local de un instante (última modificación). */
export function formatDateTime(instant: string): string {
  return new Date(instant).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" });
}

/** "13 años" / "1 año"; vacío sin edad. */
export function formatAge(age: number | null | undefined): string {
  if (age === null || age === undefined) return "";
  return age === 1 ? "1 año" : `${age} años`;
}

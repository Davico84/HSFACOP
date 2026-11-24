/** "2027-11-24" (fecha civil, sin hora) → "24/11/2027". Sin pasar por `Date`: no hay corrimiento de zona horaria. */
export function formatCivilDate(date: string): string {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

/**
 * Marcas pequeñas en `localStorage` (nunca datos del paciente): qué historias de la cuenta ya tuvieron
 * entrada en este dispositivo (para avisar si el navegador la borró) y hasta cuándo se pospuso el
 * recordatorio de exportar. Es un aviso: si el almacenamiento falla, simplemente no hay aviso.
 */
const SEEN = (accountId: number) => `hsfacop-notebook-seen:${accountId}`;
const SNOOZE = (accountId: number) => `hsfacop-notebook-snooze:${accountId}`;
const SHARED = "hsfacop-notebook-shared";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* sin almacenamiento: sin aviso */
  }
}

export function markHadEntry(accountId: number, recordId: number) {
  const seen = new Set(hadEntryIds(accountId));
  seen.add(recordId);
  write(SEEN(accountId), JSON.stringify([...seen]));
}

export function hadEntryIds(accountId: number): number[] {
  try {
    const parsed: unknown = JSON.parse(read(SEEN(accountId)) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === "number") : [];
  } catch {
    return [];
  }
}

export function hadEntry(accountId: number, recordId: number): boolean {
  return hadEntryIds(accountId).includes(recordId);
}

export function clearMarkers(accountId: number) {
  write(SEEN(accountId), null);
  write(SNOOZE(accountId), null);
}

/** Pospone el recordatorio de exportar hasta un instante. */
export function snoozeReminder(accountId: number, until: Date) {
  write(SNOOZE(accountId), until.toISOString());
}

export function reminderSnoozedUntil(accountId: number): Date | null {
  const raw = read(SNOOZE(accountId));
  const date = raw ? new Date(raw) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

/** Ajuste "Este equipo es compartido" (por dispositivo, no por cuenta). */
export function isSharedDevice(): boolean {
  return read(SHARED) === "1";
}

export function setSharedDevice(shared: boolean) {
  write(SHARED, shared ? "1" : null);
}

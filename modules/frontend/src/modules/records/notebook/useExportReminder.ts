import { useQuery } from "@tanstack/react-query";
import { listEntries } from "./notebookDb";
import { reminderSnoozedUntil } from "./notebookMarkers";
import type { NotebookEntry } from "./notebookSchema";

export const REMINDER_AFTER_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Entradas con cambios que nunca se exportaron o se cambiaron después de la última exportación. */
export function entriesWithUnexportedChanges(entries: NotebookEntry[]): NotebookEntry[] {
  return entries.filter((entry) => entry.exportedAt === null || new Date(entry.updatedAt) > new Date(entry.exportedAt));
}

/**
 * ¿Toca recordar que exporte? Sí si hay cambios sin exportar desde hace 7 días o más (el más antiguo),
 * y el recordatorio no está pospuesto. Se calcula con la fecha de modificación de cada entrada, solo
 * informativa.
 */
export function shouldRemind(entries: NotebookEntry[], accountId: number, now = new Date()): boolean {
  const pending = entriesWithUnexportedChanges(entries);
  if (pending.length === 0) return false;
  const snoozed = reminderSnoozedUntil(accountId);
  if (snoozed && snoozed > now) return false;
  const oldest = Math.min(...pending.map((entry) => new Date(entry.updatedAt).getTime()));
  return now.getTime() - oldest >= REMINDER_AFTER_DAYS * DAY_MS;
}

export function useExportReminder(accountId: number | null | undefined) {
  return useQuery({
    queryKey: ["notebook", "reminder", accountId ?? 0],
    queryFn: async () => {
      const entries = await listEntries(accountId as number);
      return { remind: shouldRemind(entries, accountId as number), entryCount: entries.length };
    },
    enabled: accountId != null,
    gcTime: 0,
    staleTime: 0,
    refetchOnWindowFocus: "always",
    retry: false,
  });
}

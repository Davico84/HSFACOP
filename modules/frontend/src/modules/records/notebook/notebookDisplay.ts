import { formatDate } from "../utils/recordDisplay";
import type { NotebookDocumentType, NotebookEntry } from "./notebookSchema";

const SHORT: Record<NotebookDocumentType, string> = { DNI: "DNI", FOREIGNER_CARD: "CE", PASSPORT: "Pasaporte" };

/** "DNI 74125896", "CE 001234567", "Pasaporte 12345678"; vacío sin documento. */
export function formatNotebookDocument(type: NotebookDocumentType | null, number: string): string {
  if (!type || !number) return "";
  return `${SHORT[type]} ${number}`;
}

/** "Lima, 20/05/2012", "Lima" o "20/05/2012"; vacío sin ninguno. */
export function formatBirth(entry: Pick<NotebookEntry, "birthPlace" | "birthDate">): string {
  return [entry.birthPlace, formatDate(entry.birthDate)].filter(Boolean).join(", ");
}

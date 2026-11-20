import { useQuery } from "@tanstack/react-query";
import { listEntries } from "./notebookDb";
import type { NotebookEntry } from "./notebookSchema";
import { normalizeAlias } from "../utils/alias";

/** Máximo de identificadores que se piden al servidor (el límite de la operación de búsqueda). */
export const MAX_LOCAL_MATCHES = 50;

/** Minúsculas y sin tildes, como la búsqueda del servidor. */
function plain(text: string): string {
  return text.normalize("NFD").replace(/\p{M}+/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}

export interface LocalMatches {
  /** Identificadores de las historias cuya entrada coincide, de las más reciente a la más antigua (hasta 50). */
  ids: number[];
  /** Cuántas coinciden en total (si pasan de 50, se pide afinar la búsqueda). */
  total: number;
}

/** Entradas de la libreta cuyo nombre o documento contienen el texto (sin mayúsculas ni tildes). */
export function matchEntries(entries: NotebookEntry[], text: string): LocalMatches {
  const term = plain(text);
  if (term === "") return { ids: [], total: 0 };
  const digits = term.replace(/\D/g, "");
  const matches = entries
    .filter((entry) => plain(entry.fullName).includes(term) || (digits !== "" && digits.length === term.length && entry.documentNumber.includes(digits)))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.recordId - a.recordId);
  return { ids: matches.slice(0, MAX_LOCAL_MATCHES).map((entry) => entry.recordId), total: matches.length };
}

/** Coincidencias de la libreta del dispositivo para el texto buscado. El texto nunca sale del navegador. */
export function useLocalMatches(accountId: number | null | undefined, text: string) {
  const term = text.trim();
  return useQuery({
    queryKey: ["notebook", "search", accountId ?? 0, term],
    queryFn: async (): Promise<LocalMatches> => {
      try {
        return matchEntries(await listEntries(accountId as number), term);
      } catch {
        return { ids: [], total: 0 };   // sin libreta o sin IndexedDB: no hay coincidencias locales
      }
    },
    enabled: accountId != null && term !== "",
    gcTime: 0,
    staleTime: 0,
  });
}

/** Cómo se resuelve una búsqueda: listado, identificadores locales, texto de alias o número, o nada. */
export type SearchPlan =
  | { kind: "list" }
  | { kind: "wait" }
  | { kind: "ids"; ids: number[]; total: number }
  | { kind: "text"; q: string }
  | { kind: "none" };

/** Una a dos palabras de alias o un número de historia: lo que sí puede buscarse en el servidor. */
const ALIAS_LIKE = /^[\p{L}\p{M}\p{N}'’-]{1,30}(?: [\p{L}\p{M}\p{N}'’-]{1,30})?$/u;

/**
 * Decide cómo buscar. Con coincidencias en la libreta (nombre o documento) se piden las historias por
 * identificadores y el texto no se envía. Sin coincidencias, solo un texto con forma de alias (una o dos
 * palabras) o de número de historia se busca en el servidor; un nombre completo de tres palabras o más
 * nunca sale del navegador y se informa que no hay coincidencias en este dispositivo.
 */
export function planSearch(text: string, local: { data?: LocalMatches; isPending: boolean } | null): SearchPlan {
  const q = normalizeAlias(text);
  if (q === "") return { kind: "list" };
  if (local === null) return { kind: "text", q };
  if (local.isPending) return { kind: "wait" };
  if (local.data && local.data.ids.length > 0) return { kind: "ids", ids: local.data.ids, total: local.data.total };
  return ALIAS_LIKE.test(q) ? { kind: "text", q } : { kind: "none" };
}

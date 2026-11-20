import { useQuery } from "@tanstack/react-query";
import { lookupEntry, type NotebookLookup } from "./notebookService";

export const notebookKeys = {
  entry: (accountId: number, recordId: number, recordNumber: string) => ["notebook", accountId, recordId, recordNumber] as const,
};

/**
 * Lee la libreta local de esta cuenta para una historia. Nunca se cachea entre pantallas (otra pestaña
 * puede editarla): siempre se vuelve a leer al montar y al volver a la ventana. Sin cuenta o sin
 * historia no consulta.
 */
export function useNotebookEntry(accountId: number | null | undefined, recordId: number | null, recordNumber: string | undefined) {
  return useQuery<NotebookLookup>({
    queryKey: notebookKeys.entry(accountId ?? 0, recordId ?? 0, recordNumber ?? ""),
    queryFn: () => lookupEntry(accountId as number, recordId as number, recordNumber as string),
    enabled: accountId != null && recordId != null && recordNumber != null,
    gcTime: 0,
    staleTime: 0,
    refetchOnWindowFocus: "always",
  });
}

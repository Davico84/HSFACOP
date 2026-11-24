import { useSessionStore } from "@/store/useSessionStore";

/** La cuenta autenticada venció (solo lectura). Lo calcula el servidor; el cliente no compara relojes. */
export function useReadOnly(): boolean {
  return useSessionStore((s) => s.user?.readOnly === true);
}

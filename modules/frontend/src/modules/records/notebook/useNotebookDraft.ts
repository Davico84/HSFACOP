import { useEffect, useRef, useState } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSessionStore } from "@/store/useSessionStore";
import { NotebookError, hasIndexedDb, notebookErrorMessage } from "./notebookDb";
import { hadEntry, markHadEntry } from "./notebookMarkers";
import { EMPTY_NOTEBOOK_FIELDS, fieldsOf, notebookFieldsSchema, type NotebookFields } from "./notebookSchema";
import { discardPending, stashPending } from "./notebookPending";
import { requestPersistence, updateEntry } from "./notebookService";
import { useNotebookEntry } from "./useNotebookEntry";

export interface NotebookRecordRef {
  id: number;
  recordNumber: string;
}

/** Por qué los campos de la libreta no se pueden editar (null = se pueden). */
export type NotebookBlock = "unavailable" | "mismatch" | null;

export interface NotebookDraft {
  form: UseFormReturn<NotebookFields>;
  blocked: NotebookBlock;
  /** La historia aún no existe: lo escrito espera en memoria y pasa a la libreta al crearla. */
  noRecord: boolean;
  /** Mensaje visible del último fallo al guardar (cuota, actualización bloqueada…); la entrada no figura como guardada. */
  error: string | null;
  /** Se guardó al menos una vez en esta sesión (o ya había entrada). */
  saved: boolean;
  /** Primer guardado de esta historia en este dispositivo: se muestra el aviso de pérdida. */
  firstSave: boolean;
  /** La historia antes tenía entrada y la libreta ya no existe (el navegador pudo borrarla). */
  lost: boolean;
}

const DEBOUNCE_MS = 600;

/**
 * Borrador de una parte de la libreta (paso 1 o firmas) ligado a una historia. Los campos viven en un
 * formulario propio, NUNCA en el de la historia: nada de esto se envía al servidor. Guarda en
 * IndexedDB al dejar de escribir y solo si es válido; `keys` son los campos que escribe esta parte, el
 * resto de la entrada se conserva. Si algo falla lo dice, no da nada por guardado y no guarda en otro lugar.
 */
export function useNotebookDraft(record: NotebookRecordRef | null, keys: readonly (keyof NotebookFields)[]): NotebookDraft {
  const accountId = useSessionStore((s) => s.user?.id) ?? null;
  const lookup = useNotebookEntry(accountId, record?.id ?? null, record?.recordNumber);
  const form = useForm<NotebookFields>({
    resolver: zodResolver(notebookFieldsSchema),
    mode: "onTouched",
    defaultValues: EMPTY_NOTEBOOK_FIELDS,
  });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [firstSave, setFirstSave] = useState(false);
  const seeded = useRef<string | null>(null);

  const status = lookup.data?.status;
  let blocked: NotebookBlock = null;
  if (!hasIndexedDb() || status === "unavailable") blocked = "unavailable";
  else if (status === "mismatch") blocked = "mismatch";

  const hadBefore = accountId !== null && record !== null && hadEntry(accountId, record.id);
  const lost = status === "empty" && hadBefore && !saved;

  // Lo que identifica la historia (el objeto `record` cambia en cada render de quien llama).
  const recordId = record?.id ?? null;
  const recordNumber = record?.recordNumber ?? null;

  // Llena el formulario con la entrada guardada una sola vez por historia (volver a leer no pisa lo que se escribe).
  const entry = lookup.data?.status === "found" ? lookup.data.entry : null;
  useEffect(() => {
    if (recordId === null || recordNumber === null || lookup.data === undefined) return;
    const key = `${recordId}:${recordNumber}`;
    if (seeded.current === key) return;
    seeded.current = key;
    // Si el usuario ya empezó a escribir antes de que llegue la lectura, lo escrito no se pisa.
    form.reset(fieldsOf(entry), { keepDirtyValues: true });
    if (entry && accountId !== null) markHadEntry(accountId, recordId);
  }, [recordId, recordNumber, lookup.data, entry, form, accountId]);

  // Guarda al dejar de escribir, solo si es válido. Al salir de la pantalla lo pendiente se guarda ya,
  // no se pierde.
  useEffect(() => {
    if (recordId === null || recordNumber === null || accountId === null || blocked) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pending = false;
    const save = async () => {
      pending = false;
      const valid = await form.trigger();
      if (!valid) return;
      const all = form.getValues();
      const changes = Object.fromEntries(keys.map((key) => [key, all[key]])) as Partial<NotebookFields>;
      try {
        const result = await updateEntry({ accountId, recordId, recordNumber, changes });
        if (!result.ok) return;
        setError(null);
        const first = !hadEntry(accountId, recordId);
        markHadEntry(accountId, recordId);
        setSaved(true);
        if (first) {
          setFirstSave(true);
          void requestPersistence();
        }
      } catch (failure) {
        setError(notebookErrorMessage(failure instanceof NotebookError ? failure : null));
      }
    };
    const unsubscribe = form.subscribe({
      formState: { values: true },
      callback: ({ type }) => {
        // Solo lo que escribe el usuario: llenar o reiniciar el formulario no guarda nada.
        if (type !== "change") return;
        clearTimeout(timer);
        pending = true;
        timer = setTimeout(() => void save(), DEBOUNCE_MS);
      },
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
      if (pending) void save();
    };
  }, [recordId, recordNumber, accountId, blocked, form, keys]);

  // Sin historia aún: lo escrito espera en memoria y se pasa a la libreta al crearla (RecordForm).
  const noRecord = record === null;
  useEffect(() => {
    if (!noRecord || accountId === null || blocked) return;
    const unsubscribe = form.subscribe({
      formState: { values: true },
      callback: ({ type, values }) => {
        if (type !== "change") return;
        stashPending(accountId, Object.fromEntries(keys.map((key) => [key, values[key]])) as Partial<NotebookFields>);
      },
    });
    return () => {
      unsubscribe();
      discardPending();   // si se abandona la creación, no queda nada (al crear, RecordForm ya lo tomó)
    };
  }, [noRecord, accountId, blocked, form, keys]);

  return { form, blocked, noRecord, error, saved, firstSave, lost };
}

import { FormProvider } from "react-hook-form";
import { TextField } from "@/modules/core/components/form/TextField";
import type { NotebookFields } from "../../notebook/notebookSchema";
import { useNotebookDraft, type NotebookRecordRef } from "../../notebook/useNotebookDraft";
import { NotebookNotice } from "./NotebookNotice";

const KEYS = ["signerName", "signerRelationship"] as const;

interface NotebookSignerFieldsProps {
  record: NotebookRecordRef | null;
  /** Firma el apoderado (paciente menor de 18 años). */
  guardian: boolean;
}

/**
 * Nombre y parentesco de quien firma (paciente o apoderado), "solo en este dispositivo": el servidor
 * ya no los guarda; la libreta del navegador los imprime en la hoja de firmas.
 */
export function NotebookSignerFields({ record, guardian }: NotebookSignerFieldsProps) {
  const draft = useNotebookDraft(record, KEYS);
  const readOnly = draft.blocked !== null;
  return (
    <section aria-labelledby="s8-notebook" className="grid gap-4 rounded-lg border border-dashed border-border p-4 md:grid-cols-2">
      <h3 id="s8-notebook" className="text-lg font-semibold md:col-span-2">
        Solo en este dispositivo
      </h3>
      <NotebookNotice draft={draft} />
      <FormProvider {...draft.form}>
        <TextField<NotebookFields>
          name="signerName"
          label={guardian ? "Nombre del apoderado" : "Nombre de quien firma"}
          readOnly={readOnly}
          hint={guardian ? undefined : "Si se deja vacío se imprime el nombre del paciente de la libreta."}
        />
        {guardian ? (
          <TextField<NotebookFields> name="signerRelationship" label="Parentesco" placeholder="Madre, padre, tutor…" readOnly={readOnly} />
        ) : null}
      </FormProvider>
    </section>
  );
}

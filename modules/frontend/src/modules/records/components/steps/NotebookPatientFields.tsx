import { FormProvider, useFormContext, useWatch } from "react-hook-form";
import { TextField } from "@/modules/core/components/form/TextField";
import { ChoiceField } from "@/modules/core/components/form/ChoiceField";
import { Button } from "@/modules/core/ui/button";
import type { RecordFormValues } from "../../schemas/record";
import { notebookDocumentOptions } from "../../notebook/notebookOptions";
import type { NotebookFields } from "../../notebook/notebookSchema";
import { suggestAlias } from "../../notebook/suggestAlias";
import { useNotebookDraft, type NotebookRecordRef } from "../../notebook/useNotebookDraft";
import { NotebookLegacyCopy } from "./NotebookLegacyCopy";
import { NotebookNotice } from "./NotebookNotice";

const KEYS = ["fullName", "documentType", "documentNumber", "birthDate", "birthPlace", "address", "phone"] as const;

interface NotebookPatientFieldsProps {
  record: NotebookRecordRef | null;
}

/**
 * Datos del paciente que el servidor ya no guarda (nombre, documento, nacimiento, domicilio y
 * celular), "solo en este dispositivo": viven en la libreta del navegador y se imprimen en la hoja.
 * Proponen el alias a partir del nombre (calculado aquí; el nombre nunca se envía).
 */
export function NotebookPatientFields({ record }: NotebookPatientFieldsProps) {
  // El formulario de la historia (el alias es suyo); dentro de esta sección manda el de la libreta.
  const outer = useFormContext<RecordFormValues>();
  const alias = useWatch({ control: outer.control, name: "patientAlias" });
  const draft = useNotebookDraft(record, KEYS);
  const fullName = useWatch({ control: draft.form.control, name: "fullName" });
  const readOnly = draft.blocked !== null;
  const suggestion = suggestAlias(fullName ?? "");
  const aliasEmpty = !alias || alias.trim() === "";

  const applySuggestion = () => {
    if (suggestion) outer.setValue("patientAlias", suggestion, { shouldDirty: true, shouldValidate: true });
  };

  return (
    <section aria-labelledby="s1-notebook" className="grid gap-4 rounded-lg border border-dashed border-border p-4 md:grid-cols-2">
      <h3 id="s1-notebook" className="text-lg font-semibold md:col-span-2">
        Solo en este dispositivo
      </h3>
      <NotebookNotice draft={draft} />
      <NotebookLegacyCopy record={record} onCopied={(fields) => draft.form.reset(fields)} />
      <FormProvider {...draft.form}>
        <TextField<NotebookFields> name="fullName" label="Nombre y apellidos" className="md:col-span-2" autoComplete="off" readOnly={readOnly} />
        {suggestion && !readOnly ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm md:col-span-2">
            <span className="text-muted-foreground">
              Alias propuesto: <strong className="text-foreground">{suggestion}</strong>
            </span>
            {aliasEmpty ? (
              <Button type="button" size="sm" variant="secondary" onClick={applySuggestion}>
                Usar este alias
              </Button>
            ) : alias?.trim() !== suggestion ? (
              <Button type="button" size="sm" variant="secondary" onClick={applySuggestion}>
                Reemplazar el alias actual
              </Button>
            ) : (
              <span className="text-muted-foreground">Ya es el alias de la historia</span>
            )}
          </div>
        ) : null}
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
          <ChoiceField<NotebookFields> name="documentType" label="Documento" options={notebookDocumentOptions} vertical readOnly={readOnly} />
          <TextField<NotebookFields> name="documentNumber" label="Número" inputMode="numeric" autoComplete="off" readOnly={readOnly} />
        </div>
        <TextField<NotebookFields> name="birthDate" label="Fecha de nacimiento" type="date" readOnly={readOnly} />
        <TextField<NotebookFields> name="birthPlace" label="Lugar de nacimiento" readOnly={readOnly} />
        <TextField<NotebookFields> name="phone" label="Celular" inputMode="tel" readOnly={readOnly} />
        <TextField<NotebookFields> name="address" label="Domicilio" className="md:col-span-2" readOnly={readOnly} />
      </FormProvider>
    </section>
  );
}

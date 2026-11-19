import { useFormContext, useWatch } from "react-hook-form";
import { TextField } from "@/modules/core/components/form/TextField";
import type { RecordFormValues } from "../../schemas/record";
import { FieldHint } from "@/modules/core/components/form/FieldHint";
import { NotebookSignerFields } from "./NotebookSignerFields";
import type { NotebookRecordRef } from "../../notebook/useNotebookDraft";
import { isMinor } from "../../utils/age";

/**
 * Paso 8 (pág. 13): firmas. Las firmas, los nombres de quien firma y la fecha se hacen a mano sobre
 * la hoja impresa: el sistema ya no guarda el nombre ni el parentesco del paciente ni del apoderado.
 * Solo indica quién firma según la edad escrita (apoderado si es menor de 18) y guarda los nombres de
 * los supervisores y del tratante.
 */
interface Step8SignaturesProps {
  record?: NotebookRecordRef | null;
}

export function Step8Signatures({ record = null }: Step8SignaturesProps) {
  const { control } = useFormContext<RecordFormValues>();
  const [age, treatingDentist] = useWatch({ control, name: ["patientAge", "treatingDentist"] });
  const minor = isMinor(age);

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        Las firmas y la fecha se hacen a mano sobre la hoja impresa; aquí solo se escriben los nombres de los supervisores y del tratante.
      </p>
      <FieldHint>
        {minor
          ? "Paciente menor de edad: firma el apoderado. Su nombre y parentesco se escriben a mano en la hoja impresa."
          : "Firma el paciente. Su nombre se escribe a mano en la hoja impresa."}
      </FieldHint>
      <NotebookSignerFields record={record} guardian={minor} />
      <fieldset className="grid gap-4 md:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold">Firma supervisor</legend>
        <TextField name="content.signatures.supervisor1Name" label="Supervisor 1" />
        <TextField name="content.signatures.supervisor2Name" label="Supervisor 2" />
      </fieldset>
      <fieldset className="grid gap-4">
        <legend className="mb-2 text-sm font-semibold">Firma del tratante</legend>
        <TextField name="content.signatures.treatingSignatureName" label="Nombre del tratante" placeholder={treatingDentist ?? ""}
          hint="Si se deja vacío se imprime el odontólogo tratante." />
      </fieldset>
    </div>
  );
}

import { useEffect, useRef } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { TextField } from "@/modules/core/components/form/TextField";
import { CheckboxField } from "@/modules/core/components/form/CheckboxField";
import { FieldHint } from "@/modules/core/components/form/FieldHint";
import { fieldError } from "@/modules/core/components/form/fieldError";
import type { RecordFormValues } from "../../schemas/record";
import { ALIAS_MAX_CODE_POINTS, aliasLooksReal, aliasViolation, normalizeAlias } from "../../utils/alias";

interface AliasFieldProps {
  readOnly?: boolean;
}

/**
 * Alias del paciente (una o dos palabras, sin apellidos). El servidor ya no guarda el nombre real:
 * si el alias tiene dos palabras o coincide con una palabra de un texto libre, avisa y pide
 * confirmar que no es el nombre real antes de guardar. Es una ayuda, no una garantía.
 */
export function AliasField({ readOnly = false }: AliasFieldProps) {
  const { control, formState, setValue } = useFormContext<RecordFormValues>();
  const [alias, content] = useWatch({ control, name: ["patientAlias", "content"] });
  const normalized = normalizeAlias(alias ?? "");
  const needsConfirm = aliasViolation(alias) === null && aliasLooksReal(alias, content);
  const confirmError = fieldError(formState.errors, "aliasConfirmed");

  // Cambiar el alias vuelve a pedir la confirmación; abrir una historia con alias no.
  const previous = useRef(normalized);
  useEffect(() => {
    if (previous.current !== normalized) {
      previous.current = normalized;
      setValue("aliasConfirmed", null, { shouldValidate: true });
    }
  }, [normalized, setValue]);

  return (
    <div className="flex flex-col gap-2 md:col-span-2">
      <TextField name="patientAlias" label="Alias del paciente" autoComplete="off" maxLength={ALIAS_MAX_CODE_POINTS * 2}
        readOnly={readOnly}
        hint="Una o dos palabras, sin apellidos. El nombre completo y el documento se escriben a mano en la hoja impresa." />
      {needsConfirm && !readOnly ? (
        <div role="alert" className="flex flex-col gap-2">
          <FieldHint>
            Un alias de dos palabras, o que se repite en un texto de la historia, puede ser el nombre real del paciente.
            El sistema no debe guardarlo.
          </FieldHint>
          <CheckboxField<RecordFormValues> name="aliasConfirmed" label="Confirmo que el alias no es el nombre real del paciente" />
          {confirmError ? <p className="text-sm text-destructive">{confirmError}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

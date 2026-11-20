import { useFormContext, useWatch } from "react-hook-form";
import { TextField } from "@/modules/core/components/form/TextField";
import { MeasureField } from "@/modules/core/components/form/MeasureField";
import { TextAreaField } from "@/modules/core/components/form/TextAreaField";
import { ChoiceField } from "@/modules/core/components/form/ChoiceField";
import { AliasField } from "./AliasField";
import { NotebookPatientFields } from "./NotebookPatientFields";
import type { NotebookRecordRef } from "../../notebook/useNotebookDraft";
import type { RecordFormValues } from "../../schemas/record";
import { LONG_TEXT, MAX_MENARCHE_AGE, MENARCHE_TOO_YOUNG, MIN_MENARCHE_AGE } from "../../schemas/record";
import { cooperationOptions, NOT_REPORTED, oralHygieneOptions, sexOptions, yesNoOptions } from "../../config/options";
import { MAX_AGE, MIN_AGE } from "../../utils/age";

interface Step1PatientProps {
  /**
   * Datos del paciente fijos tras imprimir: alias, sexo y edad de solo lectura (siguen en el
   * formulario y se envían sin cambios al guardar).
   */
  patientLocked?: boolean;
  /** La historia ya creada: la libreta local se liga a ella. */
  record?: NotebookRecordRef | null;
}

/** Paso 1 (pág. 1): alias, sexo y edad del paciente, y anamnesis. La edad se escribe (no se calcula). */
export function Step1Patient({ patientLocked = false, record = null }: Step1PatientProps) {
  const { control } = useFormContext<RecordFormValues>();
  const [age, sex, menarche] = useWatch({
    control,
    name: ["patientAge", "patientSex", "content.anamnesis.menarche"],
  });
  const tooYoung = typeof age === "number" && age < MIN_MENARCHE_AGE;

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="s1-patient" className="grid gap-4 md:grid-cols-2">
        <h3 id="s1-patient" className="text-lg font-semibold md:col-span-2">Paciente</h3>
        <TextField name="recordNumber" label="Nro. de historia" placeholder="AEO-0001" autoComplete="off"
          hint="Lo asignan los docentes. Se puede corregir aunque la historia ya esté impresa." />
        <TextField name="treatingDentist" label="Odontólogo tratante" />
        <AliasField readOnly={patientLocked} />
        <ChoiceField name="patientSex" label="Sexo" options={sexOptions} readOnly={patientLocked} />
        <MeasureField name="patientAge" label="Edad al inicio del tratamiento" unit="años" step={1} min={MIN_AGE} max={MAX_AGE}
          readOnly={patientLocked} />
        <TextField name="treatmentStartDate" label="Fecha de inicio de tratamiento" type="date" />
      </section>

      <NotebookPatientFields record={record} />

      <section aria-labelledby="s1-anamnesis" className="flex flex-col gap-4">
        <h3 id="s1-anamnesis" className="text-lg font-semibold">Anamnesis</h3>
        <p className="text-sm text-muted-foreground">Los textos que se dejen vacíos se imprimen como "{NOT_REPORTED}".</p>
        <TextAreaField name="content.anamnesis.chiefComplaint" label="Queja principal – ¿Por qué buscó tratamiento?" maxLength={LONG_TEXT} placeholder={NOT_REPORTED} />
        <TextAreaField name="content.anamnesis.personalPreferences" label="Gustos personales (color, canal preferido en YouTube, juguetes)" maxLength={LONG_TEXT} placeholder={NOT_REPORTED} />
        <ChoiceField name="content.anamnesis.cooperation" label="Índice de colaboración / cooperación" options={cooperationOptions} />
        <div className="grid gap-4 md:grid-cols-2">
          <ChoiceField name="content.anamnesis.oralHygiene" label="Higiene oral" options={oralHygieneOptions} />
          <ChoiceField name="content.anamnesis.suckingHabits" label="Hábitos de succión" options={yesNoOptions}
            hint="El detalle (dedos, lengua…) se marca en el análisis funcional." />
        </div>
        {sex === "FEMALE" ? (
          <div className="grid gap-4 md:grid-cols-2">
            <ChoiceField name="content.anamnesis.menarche" label="¿La 1ª menstruación ya ocurrió?" options={yesNoOptions}
              disabledValues={tooYoung ? ["YES"] : undefined} hint={tooYoung && menarche !== "YES" ? MENARCHE_TOO_YOUNG : undefined} />
            {menarche === "YES" ? (
              <MeasureField name="content.anamnesis.menarcheAge" label="Edad de la 1ª menstruación" unit="años" step={1}
                min={MIN_MENARCHE_AGE} max={MAX_MENARCHE_AGE} />
            ) : null}
          </div>
        ) : null}
        <TextAreaField name="content.anamnesis.medicalHistory" label="Historia médica / medicación de uso continuo" maxLength={LONG_TEXT} placeholder={NOT_REPORTED} />
        <TextAreaField name="content.anamnesis.accidentsHistory" label="Histórico de accidentes o traumas" maxLength={LONG_TEXT} placeholder={NOT_REPORTED} />
        <TextAreaField name="content.anamnesis.familyStructure" label="Estructura familiar" maxLength={LONG_TEXT} placeholder={NOT_REPORTED} />
        <TextAreaField name="content.anamnesis.generalTreatmentNeeds" label="Necesidad de tratamiento general (caries, endodoncia, exodoncia)" maxLength={LONG_TEXT} placeholder={NOT_REPORTED} />
        <TextAreaField name="content.anamnesis.heredity" label="Características importantes de la herencia" maxLength={LONG_TEXT} placeholder={NOT_REPORTED} />
      </section>
    </div>
  );
}

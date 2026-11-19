import type { RecordResponse } from "@/modules/core/services/generated/model";
import { cooperationOptions, NOT_REPORTED, oralHygieneOptions, sexOptions, yesNoOptions } from "../../config/options";
import { formatAge, formatDate } from "../../utils/recordDisplay";
import { PrintChoice } from "./PrintChoice";
import { PrintField } from "./PrintField";
import { PrintLines } from "./PrintLines";
import { PrintPage } from "./PrintPage";
import { PrintTitle } from "./PrintTitle";
import type { NotebookEntry } from "../../notebook/notebookSchema";
import { formatBirth, formatNotebookDocument } from "../../notebook/notebookDisplay";

interface PrintPatientSectionProps {
  record: RecordResponse;
  /** Entrada de la libreta local (copia tomada antes de imprimir); sin ella las líneas quedan en blanco. */
  notebook?: NotebookEntry | null;
}

/**
 * Pág. 1: odontólogo tratante, datos del paciente y anamnesis (texto vacío → "No refiere"). El sistema
 * guarda alias, sexo y edad; el nombre y apellidos, el documento, el nacimiento, el domicilio y el celular
 * quedan en blanco para escribirlos a mano, o los completa la libreta local del dispositivo si tiene
 * entrada de esa historia (el navegador los une al imprimir; el servidor nunca los recibe).
 */
export function PrintPatientSection({ record, notebook = null }: PrintPatientSectionProps) {
  const a = record.content.anamnesis;
  const sex = sexOptions.find((option) => option.value === record.patientSex)?.label ?? "";
  return (
    <PrintPage recordNumber={record.recordNumber} first>
      <div className="flex"><PrintField label="ODONTÓLOGO TRATANTE:" value={record.treatingDentist} /></div>
      <PrintTitle>ANAMNESIS</PrintTitle>
      <div className="flex gap-4">
        <PrintField label="ALIAS" value={record.patientAlias} grow={2} lined />
        <PrintField label="Edad:" value={formatAge(record.patientAge)} lined center />
        <PrintField label="Sexo:" value={sex} lined center />
      </div>
      <div className="flex"><PrintField label="Nombre y apellidos" value={notebook?.fullName ?? ""} lined /></div>
      <div className="flex gap-4">
        <PrintField label="Fecha de inicio de tratamiento:" value={formatDate(record.treatmentStartDate)} grow={2} lined center />
        <PrintField label="Documento" value={notebook ? formatNotebookDocument(notebook.documentType, notebook.documentNumber) : ""} lined center />
      </div>
      <div className="flex gap-4">
        <PrintField label="Lugar y fecha de nacimiento del paciente" value={notebook ? formatBirth(notebook) : ""} grow={2} lined center />
        <PrintField label="Celular" value={notebook?.phone ?? ""} lined center />
      </div>
      <div className="flex"><PrintField label="Domicilio" value={notebook?.address ?? ""} lined /></div>
      <PrintLines label="Queja principal - ¿Por qué buscó tratamiento?" value={a.chiefComplaint} emptyText={NOT_REPORTED} lines={2} />
      <PrintLines label="Gustos personales (color, canal preferido en YouTube, juguetes)." value={a.personalPreferences} emptyText={NOT_REPORTED} lines={1} />
      <PrintChoice label="Índice de colaboración/cooperación:" options={cooperationOptions} value={a.cooperation} />
      <div className="flex flex-wrap gap-x-8">
        <PrintChoice label="Higiene oral:" options={oralHygieneOptions} value={a.oralHygiene} />
        <PrintChoice label="Hábitos de succión:" options={yesNoOptions} value={a.suckingHabits} />
      </div>
      {record.patientSex === "FEMALE" ? (
        <div className="flex flex-wrap items-baseline gap-x-8">
          <PrintChoice label="¿La 1ª menstruación ya ocurrió?" options={yesNoOptions} value={a.menarche} />
          {a.menarche === "YES" && a.menarcheAge != null ? (
            <PrintField label="Edad:" value={`${a.menarcheAge} años`} lined center />
          ) : null}
        </div>
      ) : null}
      <PrintLines label="Historia médica/medicación de uso continuo." value={a.medicalHistory} emptyText={NOT_REPORTED} lines={2} />
      <PrintLines label="Histórico de accidentes o traumas." value={a.accidentsHistory} emptyText={NOT_REPORTED} lines={2} />
      <PrintLines label="Estructura familiar" value={a.familyStructure} emptyText={NOT_REPORTED} lines={2} />
      <PrintLines label="Necesidad de tratamiento general (caries, endodoncia, exodoncia)." value={a.generalTreatmentNeeds} emptyText={NOT_REPORTED} lines={2} />
      <PrintLines label="Características importantes de la herencia." value={a.heredity} emptyText={NOT_REPORTED} lines={2} />
    </PrintPage>
  );
}

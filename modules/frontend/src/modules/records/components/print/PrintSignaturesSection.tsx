import type { RecordResponse } from "@/modules/core/services/generated/model";
import { isMinor } from "../../utils/age";
import { PrintField } from "./PrintField";
import { PrintSignatureRow } from "./PrintSignatureRow";
import { PrintLines } from "./PrintLines";
import { PrintPage } from "./PrintPage";
import { LABEL } from "./printStyle";
import type { NotebookEntry } from "../../notebook/notebookSchema";

interface PrintSignaturesSectionProps {
  record: RecordResponse;
  /** Entrada de la libreta local; sin ella el nombre y el parentesco de quien firma quedan en blanco. */
  notebook?: NotebookEntry | null;
}

/**
 * Pág. 13: plan de tratamiento final y firmas a mano (fecha en blanco; apoderado si es menor). El
 * nombre y el parentesco de quien firma, paciente o apoderado, se escriben a mano o los completa la
 * libreta local del dispositivo.
 */
export function PrintSignaturesSection({ record, notebook = null }: PrintSignaturesSectionProps) {
  const s = record.content.signatures;
  const minor = isMinor(record.patientAge);
  return (
    <PrintPage recordNumber={record.recordNumber} title="Plan de tratamiento final">
      <PrintLines value={record.content.diagnosis.finalTreatmentPlan} lines={8} />
      <div className="mt-[24pt] flex"><PrintField label="FECHA:" value="" className="max-w-72" lined /></div>
      {minor ? (
        <>
          <p className={`mt-[17pt] ${LABEL}`}>FIRMA DEL APODERADO:</p>
          <PrintSignatureRow name={notebook?.signerName || null} relationship={notebook?.signerRelationship || null} />
        </>
      ) : (
        <>
          <p className={`mt-[17pt] ${LABEL}`}>FIRMA DEL PACIENTE:</p>
          <PrintSignatureRow name={notebook?.signerName || notebook?.fullName || null} />
        </>
      )}
      <p className={`mt-[17pt] ${LABEL}`}>FIRMA SUPERVISOR:</p>
      <PrintSignatureRow name={s.supervisor1Name} />
      <div className="mt-[10pt]"><PrintSignatureRow name={s.supervisor2Name} /></div>
      <p className={`mt-[17pt] ${LABEL}`}>FIRMA DEL TRATANTE:</p>
      <PrintSignatureRow name={s.treatingSignatureName ?? record.treatingDentist} />
    </PrintPage>
  );
}

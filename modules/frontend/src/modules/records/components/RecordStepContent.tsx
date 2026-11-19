import { Step1Patient } from "./steps/Step1Patient";
import { Step2Facial } from "./steps/Step2Facial";
import { Step3Functional } from "./steps/Step3Functional";
import { Step4Occlusal } from "./steps/Step4Occlusal";
import { Step5Models } from "./steps/Step5Models";
import { Step6Radiographic } from "./steps/Step6Radiographic";
import { Step7Diagnosis } from "./steps/Step7Diagnosis";
import { Step8Signatures } from "./steps/Step8Signatures";
import type { NotebookRecordRef } from "../notebook/useNotebookDraft";

interface RecordStepContentProps {
  step: number;
  /** Datos del paciente fijos (ya se imprimió): de solo lectura en el paso 1. */
  patientLocked?: boolean;
  /** La historia ya creada (identificador y número): la libreta local se liga a ella. Sin ella, la libreta espera. */
  record?: NotebookRecordRef | null;
}

/** Contenido del paso actual. */
export function RecordStepContent({ step, patientLocked = false, record = null }: RecordStepContentProps) {
  switch (step) {
    case 2:
      return <Step2Facial />;
    case 3:
      return <Step3Functional />;
    case 4:
      return <Step4Occlusal />;
    case 5:
      return <Step5Models />;
    case 6:
      return <Step6Radiographic />;
    case 7:
      return <Step7Diagnosis />;
    case 8:
      return <Step8Signatures record={record} />;
    default:
      return <Step1Patient patientLocked={patientLocked} record={record} />;
  }
}

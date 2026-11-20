import type { RecordResponse } from "@/modules/core/services/generated/model";
import { PrintDiagnosisSection } from "./PrintDiagnosisSection";
import { PrintEvolutionNotesSection } from "./PrintEvolutionNotesSection";
import { PrintFacialSection } from "./PrintFacialSection";
import { PrintFunctionalSection } from "./PrintFunctionalSection";
import { PrintModelsSection } from "./PrintModelsSection";
import { PrintBoltonSection } from "./PrintBoltonSection";
import { PrintMoyersSection } from "./PrintMoyersSection";
import { PrintNanceSection } from "./PrintNanceSection";
import { PrintOcclusalSection } from "./PrintOcclusalSection";
import { PrintPatientSection } from "./PrintPatientSection";
import { PrintRadiographicSection } from "./PrintRadiographicSection";
import { PrintSignaturesSection } from "./PrintSignaturesSection";
import { PrintTanakaSection } from "./PrintTanakaSection";
import { PrintWolfordSection } from "./PrintWolfordSection";
import type { NotebookEntry } from "../../notebook/notebookSchema";

interface RecordPrintDocumentProps {
  record: RecordResponse;
  /** Libreta local del dispositivo para esta historia (copia tomada antes de imprimir), si la hay. */
  notebook?: NotebookEntry | null;
}

/**
 * La historia completa en hojas A4, en el orden y con los títulos del PDF (fase 1), más la hoja de
 * notas de evolución en blanco para llenar a mano.
 */
export function RecordPrintDocument({ record, notebook = null }: RecordPrintDocumentProps) {
  // Las cabeceras de las hojas dicen «Nombre y apellidos»: el de la libreta si lo hay y, si no, el alias
  // (la vista previa avisa de que faltan datos). El alias solo se ve donde hay datos de la base.
  const named = { ...record, patientAlias: notebook?.fullName || record.patientAlias };
  return (
    <div className="flex flex-col gap-8 py-8 font-[Arial,Helvetica,sans-serif] text-[10pt] leading-[17.3pt] text-ink print:gap-0 print:py-0">
      <PrintPatientSection record={record} notebook={notebook} />
      <PrintFacialSection record={named} />
      <PrintFunctionalSection record={named} />
      <PrintOcclusalSection record={named} />
      <PrintModelsSection record={named} />
      <PrintMoyersSection record={named} />
      <PrintTanakaSection record={named} />
      <PrintNanceSection record={named} />
      <PrintBoltonSection record={named} />
      <PrintWolfordSection record={named} />
      <PrintRadiographicSection record={named} />
      <PrintDiagnosisSection record={named} />
      <PrintSignaturesSection record={record} notebook={notebook} />
      <PrintEvolutionNotesSection recordNumber={record.recordNumber} />
    </div>
  );
}

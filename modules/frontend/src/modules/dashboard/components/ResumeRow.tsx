import { Link } from "react-router-dom";
import { ArrowRight, Info } from "lucide-react";
import type { DashboardResumeItem } from "@/modules/core/services/generated/model";
import { buttonVariants } from "@/modules/core/ui/button-variants";
import { cn } from "@/modules/core/utils/cn";
import { recordPath } from "@/routes/paths";
import { formatDateTime } from "@/modules/records/utils/recordDisplay";

interface ResumeRowProps {
  item: DashboardResumeItem;
}

/** Datos del paciente que le faltan a la historia, en el orden en que se piden. */
function missingNotes(item: DashboardResumeItem): string[] {
  const notes: string[] = [];
  if (item.missingAge) notes.push("Falta la edad");
  if (item.missingTreatmentStart) notes.push("Falta la fecha de inicio");
  return notes;
}

/**
 * Una historia para retomar: número y alias, avance y fecha, qué datos le faltan y el botón que la
 * abre en su último paso. Los avisos son texto neutro (no son un error: se completan cuando se pueda).
 */
export function ResumeRow({ item }: ResumeRowProps) {
  const step = item.lastStep ?? 1;
  const progress = item.filledSteps == null ? null : `${item.filledSteps} de 7 pasos con datos`;
  const notes = missingNotes(item);
  return (
    <li className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <p className="truncate font-medium">
          {item.recordNumber} · {item.patientName}
        </p>
        <p className="text-sm text-muted-foreground">{[progress, formatDateTime(item.updatedAt)].filter(Boolean).join(" · ")}</p>
        {notes.length > 0 ? (
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {notes.map((note) => (
              <li key={note} className="inline-flex items-center gap-1.5">
                <Info className="size-4 shrink-0" aria-hidden="true" /> {note}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <Link
        to={recordPath(item.id, step)}
        aria-label={`Continuar en paso ${step} de la historia ${item.recordNumber}`}
        className={cn(buttonVariants({ variant: "secondary" }), "w-full shrink-0 sm:w-52 pointer-coarse:h-11")}
      >
        Continuar en paso {step} <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </li>
  );
}

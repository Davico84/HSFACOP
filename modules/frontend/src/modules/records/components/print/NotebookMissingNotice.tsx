import { Link } from "react-router-dom";
import { TriangleAlert } from "lucide-react";
import { PATHS, recordPath } from "@/routes/paths";

interface NotebookMissingNoticeProps {
  recordId: number;
}

/**
 * Aviso de la vista previa (no se imprime): este dispositivo no tiene el nombre del paciente de esta
 * historia en la libreta, así que la hoja sale con el alias y sin documento, nacimiento, domicilio ni celular.
 */
export function NotebookMissingNotice({ recordId }: NotebookMissingNoticeProps) {
  return (
    <div
      role="alert"
      className="flex w-full items-start gap-3 rounded-md border border-warning/50 bg-warning/10 p-3 text-sm"
    >
      <TriangleAlert aria-hidden className="mt-0.5 size-5 shrink-0 text-warning" />
      <p>
        <strong>Faltan datos del paciente en este dispositivo.</strong> La hoja saldrá con el alias en «Nombre y apellidos» y
        con el documento, el nacimiento, el domicilio y el celular en blanco. Complétalos en el{" "}
        <Link to={recordPath(recordId, 1)} className="underline underline-offset-4">
          paso 1 de la historia
        </Link>{" "}
        o importa tu archivo desde{" "}
        <Link to={PATHS.NOTEBOOK} className="underline underline-offset-4">
          Mi libreta
        </Link>
        .
      </p>
    </div>
  );
}

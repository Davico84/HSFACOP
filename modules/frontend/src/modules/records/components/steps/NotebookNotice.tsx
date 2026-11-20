import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { PATHS } from "@/routes/paths";
import type { NotebookDraft } from "../../notebook/useNotebookDraft";

interface NotebookNoticeProps {
  draft: NotebookDraft;
}

/**
 * Avisos de la libreta: qué es y que no se envía; por qué los campos no se pueden editar; fallos al
 * guardar; el primer guardado (los datos viven solo en el dispositivo y el navegador puede borrarlos);
 * y la libreta perdida (el navegador la borró).
 */
export function NotebookNotice({ draft }: NotebookNoticeProps) {
  const { blocked, noRecord, error, firstSave, lost } = draft;
  const base = "text-sm";
  return (
    <div className="flex flex-col gap-2 md:col-span-2">
      <div role="note" className="flex items-start gap-3 rounded-md border border-primary/40 bg-primary/10 p-3 text-sm">
        <ShieldCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
        <p>
          Estos datos <strong>no se envían al servidor</strong>: se guardan solo en este navegador y se imprimen en la
          hoja. El papel firmado es el registro oficial.
        </p>
      </div>
      {noRecord ? (
        <p className={`${base} text-muted-foreground`}>Se guardarán en este dispositivo al crear la historia (al pasar al siguiente paso).</p>
      ) : null}
      {blocked === "unavailable" ? (
        <p role="alert" className={`${base} text-destructive`}>
          La libreta no está disponible en este navegador.
        </p>
      ) : null}
      {blocked === "mismatch" ? (
        <p role="alert" className={`${base} text-destructive`}>
          La libreta de este dispositivo guarda otra historia con este identificador: no corresponde y se ignora.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className={`${base} text-destructive`}>
          {error}
        </p>
      ) : null}
      {lost ? (
        <p role="status" className={base}>
          Los datos de la libreta de esta historia ya no están en este dispositivo: el navegador pudo borrarlos. Si exportaste
          un archivo, puedes importarlo desde{" "}
          <Link to={PATHS.NOTEBOOK} className="underline underline-offset-4">
            Mi libreta
          </Link>
          . La historia no tiene ningún problema.
        </p>
      ) : null}
      {firstSave ? (
        <p role="status" className={base}>
          Guardado en este dispositivo. Estos datos viven <strong>solo aquí</strong>: el navegador puede borrarlos y no hay otra
          copia.{" "}
          <Link to={PATHS.NOTEBOOK} className="underline underline-offset-4">
            Exporta tu libreta
          </Link>{" "}
          para respaldarla.
        </p>
      ) : null}
    </div>
  );
}

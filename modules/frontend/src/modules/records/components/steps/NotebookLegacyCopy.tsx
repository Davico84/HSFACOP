import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/modules/core/ui/button";
import { useSessionStore } from "@/store/useSessionStore";
import { LegacyCopyClosed, copyToNotebook, daysUntil, formatDeadline, legacyCopyAvailable, markBackedUp, verifyExport } from "../../notebook/legacyCopy";
import { confirmExported, prepareExport, type PreparedExport } from "../../notebook/notebookActions";
import { fieldsOf, type NotebookFields } from "../../notebook/notebookSchema";
import { hasIndexedDb, hasWebCrypto } from "../../notebook/notebookDb";
import type { NotebookRecordRef } from "../../notebook/useNotebookDraft";

interface NotebookLegacyCopyProps {
  record: NotebookRecordRef | null;
  /** Los datos ya están en la libreta: el formulario de la sección los muestra. */
  onCopied: (fields: NotebookFields) => void;
}

type Phase =
  | { name: "idle" }
  | { name: "working" }
  | { name: "export"; prepared: PreparedExport }
  | { name: "verifying"; prepared: PreparedExport }
  | { name: "done" }
  | { name: "error"; message: string; prepared?: PreparedExport; canMark?: boolean };

/** Descarga un texto como archivo, sin enviarlo a ningún sitio. */
function download(fileName: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/octet-stream" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * "Pasar a mi libreta": hasta la fecha límite el servidor todavía conserva los datos antiguos de las
 * historias existentes y solo el autor los ve. El autor los copia a su libreta local, exporta un archivo
 * cifrado y la aplicación lo descifra en memoria y comprueba que coincide campo por campo; solo
 * entonces la historia se marca como respaldada (una marca sin datos del paciente). Pasada la fecha, o con
 * la historia ya migrada, el servidor no los devuelve y esta acción no aparece.
 */
export function NotebookLegacyCopy({ record, onCopied }: NotebookLegacyCopyProps) {
  const accountId = useSessionStore((s) => s.user?.id) ?? null;
  const queryClient = useQueryClient();
  const available = useQuery({
    queryKey: ["notebook", "legacy-available", record?.id ?? 0],
    queryFn: () => legacyCopyAvailable(record?.id as number),
    enabled: record !== null && accountId !== null && hasIndexedDb() && hasWebCrypto(),
    gcTime: 0,
    staleTime: 0,
    retry: false,
  });
  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const [saved, setSaved] = useState(false);

  if (!record || accountId === null || (!available.data && phase.name === "idle")) return null;
  const ref = record;
  const deadline = available.data ? available.data.deadline : null;
  const daysLeft = daysUntil(deadline);
  const urgent = daysLeft !== null && daysLeft <= 3;

  const closed = (message = "La copia ya no está disponible para esta historia (venció la fecha límite o ya no es tuya).") => {
    setPhase({ name: "error", message });
    void queryClient.invalidateQueries({ queryKey: ["notebook", "legacy-available"] });
  };

  const start = async () => {
    setPhase({ name: "working" });
    try {
      const entry = await copyToNotebook(accountId, ref.id, ref.recordNumber);
      onCopied(fieldsOf(entry));
      const prepared = await prepareExport(accountId);
      setSaved(false);
      setPhase({ name: "export", prepared });
    } catch (error) {
      if (error instanceof LegacyCopyClosed) closed();
      else setPhase({ name: "error", message: "No se pudo copiar a la libreta. Vuelve a intentar." });
    }
  };

  const register = async (prepared: PreparedExport) => {
    try {
      if ((await markBackedUp(ref.id)) === "closed") return closed("Se copió y exportó, pero la copia ya no está disponible: no se marcó el respaldo.");
      await confirmExported(accountId);
      setPhase({ name: "done" });
      void queryClient.invalidateQueries({ queryKey: ["notebook"] });
    } catch {
      setPhase({ name: "error", message: "No se pudo registrar el respaldo. Tu libreta y el archivo están bien: reintenta.", prepared, canMark: true });
    }
  };

  const downloadAndVerify = async (prepared: PreparedExport) => {
    setPhase({ name: "verifying", prepared });
    download(prepared.fileName, prepared.fileText);
    const ok = await verifyExport(accountId, prepared.fileText, prepared.passphrase);
    if (!ok) {
      setPhase({ name: "error", message: "No se pudo verificar el archivo exportado: la historia no se marcó como respaldada. Vuelve a intentar.", prepared });
      return;
    }
    await register(prepared);
  };

  return (
    <div role="region" aria-label="Pasar a mi libreta" className="flex flex-col gap-3 rounded-md border border-border bg-muted/40 p-3 text-sm md:col-span-2">
      {phase.name === "done" ? (
        <p role="status">
          Listo: los datos de esta historia están en tu libreta y en un archivo cifrado verificado, y la historia quedó marcada como
          respaldada. Guarda el archivo y su frase.
        </p>
      ) : (
        <>
          <p>
            Esta historia es anterior al cambio: el servidor todavía conserva sus datos antiguos solo hasta la fecha límite de copia y
            después los borra. <strong>Pásalos a tu libreta y exporta un archivo de respaldo.</strong>
          </p>
          {deadline ? (
            <p className={urgent ? "rounded-md border border-warning/50 bg-warning/10 p-2 font-semibold" : "font-semibold"}>
              Fecha límite: {formatDeadline(deadline)}
              {daysLeft === 0 ? " (vence hoy)" : daysLeft === 1 ? " (queda 1 día)" : ` (quedan ${daysLeft} días)`}.
            </p>
          ) : null}
          {phase.name === "idle" || phase.name === "working" || phase.name === "error" ? (
            <div>
              <Button type="button" size="sm" onClick={() => void start()} disabled={phase.name === "working"}>
                {phase.name === "working" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null} Pasar a mi libreta
              </Button>
            </div>
          ) : null}
          {phase.name === "export" || phase.name === "verifying" ? (
            <div className="flex flex-col gap-2">
              <p>Copiado a tu libreta. Ahora exporta el archivo cifrado; la frase se muestra una sola vez:</p>
              <p aria-label="Frase de exportación" className="font-mono text-base font-semibold select-all">{phase.prepared.passphrase}</p>
              <label className="flex items-center gap-2">
                <input type="checkbox" className="accent-primary" checked={saved} onChange={(event) => setSaved(event.target.checked)} />
                Guardé la frase en un lugar seguro
              </label>
              <div>
                <Button type="button" size="sm" onClick={() => void downloadAndVerify(phase.prepared)} disabled={!saved || phase.name === "verifying"}>
                  <Download className="size-4" aria-hidden="true" /> Descargar y verificar
                </Button>
              </div>
            </div>
          ) : null}
          {phase.name === "error" ? (
            <div role="alert" className="flex flex-col gap-2 text-destructive">
              <p>{phase.message}</p>
              {phase.prepared ? (
                <div>
                  <Button type="button" size="sm" variant="outline" onClick={() => void (phase.canMark ? register(phase.prepared as PreparedExport) : downloadAndVerify(phase.prepared as PreparedExport))}>
                    Reintentar
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

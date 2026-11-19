import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/modules/core/ui/button";
import { useSessionStore } from "@/store/useSessionStore";
import { hasWebCrypto } from "../notebook/notebookDb";
import { NothingToExport, confirmExported, prepareExport, type PreparedExport } from "../notebook/notebookActions";

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
 * Exportar la libreta a un archivo cifrado en el navegador. La frase (6 palabras generadas aquí) se
 * muestra UNA sola vez y hay que confirmar que se guardó antes de descargar; el archivo no debe
 * enviarse por correo ni guardarse en nubes públicas. Sin `crypto.subtle` (p. ej. sin HTTPS) queda
 * deshabilitado y no se genera ningún archivo sin cifrar.
 */
export function NotebookExport() {
  const accountId = useSessionStore((s) => s.user?.id) ?? null;
  const [prepared, setPrepared] = useState<PreparedExport | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const crypto = hasWebCrypto();

  const prepare = async () => {
    if (accountId === null) return;
    setBusy(true);
    setMessage(null);
    try {
      setPrepared(await prepareExport(accountId));
      setSaved(false);
    } catch (error) {
      setMessage(error instanceof NothingToExport ? "No hay nada que exportar: la libreta de este dispositivo está vacía." : "No se pudo preparar el archivo.");
    } finally {
      setBusy(false);
    }
  };

  const downloadFile = async () => {
    if (!prepared || accountId === null) return;
    download(prepared.fileName, prepared.fileText);
    await confirmExported(accountId);
    setMessage(`Archivo descargado con ${prepared.entryCount} ${prepared.entryCount === 1 ? "entrada" : "entradas"}. La frase no se mostrará otra vez: guárdala con el archivo.`);
    setPrepared(null);
  };

  return (
    <section aria-labelledby="notebook-export" className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <h2 id="notebook-export" className="text-lg font-semibold">
        Exportar la libreta
      </h2>
      <p className="text-sm text-muted-foreground">
        Genera un archivo cifrado con todas tus entradas, para respaldarlas o pasarlas a otro dispositivo. Sin el archivo y
        su frase no hay forma de recuperarlas. <strong>No envíes el archivo por correo ni lo guardes en nubes públicas.</strong>
      </p>
      {!crypto ? (
        <p role="alert" className="text-sm text-destructive">
          Este navegador no ofrece criptografía (por ejemplo, la página se abrió sin HTTPS): exportar e importar están
          deshabilitados y no se genera ningún archivo sin cifrar.
        </p>
      ) : null}
      {prepared ? (
        <div className="flex flex-col gap-3">
          <div className="rounded-md bg-muted p-3">
            <p className="text-sm">Tu frase (se muestra una sola vez; sin ella el archivo no se abre):</p>
            <p aria-label="Frase de exportación" className="mt-1 font-mono text-lg font-semibold tracking-wide select-all">
              {prepared.passphrase}
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="accent-primary" checked={saved} onChange={(event) => setSaved(event.target.checked)} />
            Guardé la frase en un lugar seguro
          </label>
          <div>
            <Button onClick={() => void downloadFile()} disabled={!saved}>
              <Download className="size-4" aria-hidden="true" /> Descargar archivo
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <Button onClick={() => void prepare()} disabled={!crypto || busy || accountId === null}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null} Exportar libreta
          </Button>
        </div>
      )}
      {message ? (
        <p role="status" className="text-sm">
          {message}
        </p>
      ) : null}
    </section>
  );
}

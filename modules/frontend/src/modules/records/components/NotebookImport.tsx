import { useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/modules/core/ui/button";
import { Input } from "@/modules/core/ui/input";
import { Label } from "@/modules/core/ui/label";
import { useSessionStore } from "@/store/useSessionStore";
import { hasWebCrypto } from "../notebook/notebookDb";
import { importFile } from "../notebook/notebookActions";
import { IMPORT_FAILED, type MergeResult } from "../notebook/notebookFile";
import { fetchOwnRecordIds } from "../notebook/ownRecords";

function summary(result: MergeResult): string {
  const parts = [
    `${result.added} agregadas`,
    `${result.replaced} reemplazadas`,
    `${result.skipped} omitidas`,
    `${result.conflicts} ${result.conflicts === 1 ? "conflicto" : "conflictos"}`,
  ];
  if (result.foreign > 0) parts.push(`${result.foreign} de historias ajenas omitidas`);
  return `Libreta importada: ${parts.join(", ")}.`;
}

/**
 * Importar un archivo exportado con su frase. Todo se hace en el navegador: se descifra y se valida
 * antes de tocar la libreta, y solo entonces se combina por número de revisión. Cualquier problema
 * (frase incorrecta, archivo alterado, de otra cuenta, de versión desconocida, demasiado grande) se
 * muestra con el mismo mensaje, sin código ni causa.
 */
export function NotebookImport() {
  const accountId = useSessionStore((s) => s.user?.id) ?? null;
  const [file, setFile] = useState<File | null>(null);
  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const crypto = hasWebCrypto();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file || accountId === null) return;
    setBusy(true);
    setMessage(null);
    try {
      // Un archivo enorme no se lee entero: 5 MiB es el máximo y se rechaza igual con el mensaje genérico.
      const text = file.size > 5 * 1024 * 1024 ? "" : await file.text();
      const result = await importFile(accountId, text, phrase, await fetchOwnRecordIds());
      setMessage({ text: summary(result), error: false });
      setPhrase("");
      setFile(null);
    } catch {
      setMessage({ text: IMPORT_FAILED, error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="notebook-import" className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <h2 id="notebook-import" className="text-lg font-semibold">
        Importar un archivo
      </h2>
      <p className="text-sm text-muted-foreground">
        Pasa a este dispositivo la libreta exportada desde otro. Se combina por historia y gana la entrada con el número de
        revisión más alto.
      </p>
      <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="notebook-file">Archivo de la libreta (.hsflibreta)</Label>
          <Input id="notebook-file" type="file" accept=".hsflibreta" disabled={!crypto || busy}
            onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="notebook-phrase">Frase</Label>
          <Input id="notebook-phrase" autoComplete="off" spellCheck={false} value={phrase} disabled={!crypto || busy}
            onChange={(event) => setPhrase(event.target.value)} />
        </div>
        <div>
          <Button type="submit" disabled={!crypto || busy || !file || phrase.trim() === ""}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Upload className="size-4" aria-hidden="true" />} Importar
          </Button>
        </div>
      </form>
      {message ? (
        <p role={message.error ? "alert" : "status"} className={message.error ? "text-sm text-destructive" : "text-sm"}>
          {message.text}
        </p>
      ) : null}
    </section>
  );
}

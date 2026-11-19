import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/modules/core/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/modules/core/ui/alert-dialog";
import { useSessionStore } from "@/store/useSessionStore";
import { wipeNotebook } from "../notebook/notebookActions";
import { isSharedDevice, setSharedDevice } from "../notebook/notebookMarkers";
import { notebookErrorMessage } from "../notebook/notebookDb";

/**
 * Ajustes de la libreta: marcar el equipo como compartido (al cerrar sesión y tras 15 minutos sin
 * actividad se ofrece exportar y se borra la libreta) y borrar la libreta de este dispositivo. Borrar
 * no cambia ninguna historia del servidor.
 */
export function NotebookSettings() {
  const accountId = useSessionStore((s) => s.user?.id) ?? null;
  const [shared, setShared] = useState(isSharedDevice);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const toggleShared = (value: boolean) => {
    setSharedDevice(value);
    setShared(value);
  };

  const wipe = async () => {
    setConfirming(false);
    if (accountId === null) return;
    try {
      await wipeNotebook(accountId);
      setMessage({ text: "Se borró la libreta de este dispositivo. Las historias del servidor no cambiaron.", error: false });
    } catch (error) {
      setMessage({ text: notebookErrorMessage(error), error: true });
    }
  };

  return (
    <section aria-labelledby="notebook-settings" className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <h2 id="notebook-settings" className="text-lg font-semibold">
        Este dispositivo
      </h2>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-0.5 accent-primary" checked={shared} onChange={(event) => toggleShared(event.target.checked)} />
        <span>
          <strong>Este equipo es compartido.</strong> Al cerrar sesión y tras 15 minutos sin actividad se cierra la sesión y se
          borra la libreta de este dispositivo, después de ofrecerte exportarla. En un equipo no compartido, cerrar sesión la
          conserva.
        </span>
      </label>
      <div>
        <Button variant="outline" onClick={() => setConfirming(true)} disabled={accountId === null}>
          <Trash2 className="size-4" aria-hidden="true" /> Borrar la libreta de este dispositivo
        </Button>
      </div>
      {message ? (
        <p role={message.error ? "alert" : "status"} className={message.error ? "text-sm text-destructive" : "text-sm"}>
          {message.text}
        </p>
      ) : null}
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar la libreta de este dispositivo?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminan todas tus entradas de este navegador: nombres, documentos, nacimientos, domicilios y celulares. Si no
              exportaste un archivo, no hay forma de recuperarlas. Las historias del servidor no cambian.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void wipe()}>Borrar la libreta</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

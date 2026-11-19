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
import { Button } from "@/modules/core/ui/button";

interface SharedDeviceLogoutDialogProps {
  open: boolean;
  /** Va a "Mi libreta" a exportar antes de salir. */
  onExport: () => void;
  /** Borra la libreta de este dispositivo y cierra la sesión. */
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Cerrar sesión en un equipo marcado como compartido: la libreta se borra de este dispositivo, así que
 * se ofrece exportarla antes. En un equipo no compartido el cierre de sesión la conserva y este diálogo
 * no aparece.
 */
export function SharedDeviceLogoutDialog({ open, onExport, onConfirm, onCancel }: SharedDeviceLogoutDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Este equipo es compartido</AlertDialogTitle>
          <AlertDialogDescription>
            Al cerrar sesión se borra la libreta de este dispositivo (nombres, documentos, nacimientos, domicilios y celulares de
            tus pacientes). Si todavía no la exportaste, expórtala primero: sin un archivo no hay forma de recuperarla.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <Button variant="outline" onClick={onExport}>
            Exportar primero
          </Button>
          <AlertDialogAction onClick={onConfirm}>Cerrar sesión y borrar la libreta</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

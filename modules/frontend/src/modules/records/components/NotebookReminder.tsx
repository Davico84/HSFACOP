import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/modules/core/ui/button";
import { buttonVariants } from "@/modules/core/ui/button-variants";
import { PATHS } from "@/routes/paths";
import { useSessionStore } from "@/store/useSessionStore";
import { snoozeReminder } from "../notebook/notebookMarkers";
import { useExportReminder } from "../notebook/useExportReminder";

/**
 * Recordatorio de exportar la libreta: aparece cuando hay cambios sin exportar desde hace 7 días y se
 * puede posponer un día. La libreta vive solo en este dispositivo y el navegador puede borrarla; el
 * archivo cifrado es la única copia.
 */
export function NotebookReminder() {
  const accountId = useSessionStore((s) => s.user?.id) ?? null;
  const reminder = useExportReminder(accountId);
  const queryClient = useQueryClient();
  if (accountId === null || !reminder.data?.remind) return null;

  const postpone = () => {
    snoozeReminder(accountId, new Date(Date.now() + 24 * 60 * 60 * 1000));
    void queryClient.invalidateQueries({ queryKey: ["notebook", "reminder"] });
  };

  return (
    <div role="status" className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/60 px-4 py-3 text-sm">
      <p className="min-w-0 flex-1">
        Hace más de 7 días que tu libreta tiene cambios sin exportar. Vive solo en este dispositivo y el navegador puede
        borrarla: exporta un archivo para respaldarla.
      </p>
      <Link to={PATHS.NOTEBOOK} className={buttonVariants({ size: "sm" })}>
        Exportar ahora
      </Link>
      <Button size="sm" variant="outline" onClick={postpone}>
        Recordármelo mañana
      </Button>
    </div>
  );
}

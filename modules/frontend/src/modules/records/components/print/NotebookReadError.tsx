import { Button } from "@/modules/core/ui/button";

interface NotebookReadErrorProps {
  onRetry: () => void;
  onPrintBlank: () => void;
}

/**
 * La libreta del dispositivo no se pudo leer antes de imprimir: no se imprime ni se registra todavía.
 * Se ofrece reintentar, o imprimir con las líneas en blanco (que sigue el flujo normal: registra la
 * impresión y fija los datos).
 */
export function NotebookReadError({ onRetry, onPrintBlank }: NotebookReadErrorProps) {
  return (
    <div role="alert" className="flex w-full flex-wrap items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
      <p className="flex-1">
        No se pudo leer la libreta de este dispositivo, así que todavía no se imprimió. Puedes reintentar o imprimir con
        las líneas en blanco para escribirlas a mano.
      </p>
      <Button size="sm" variant="outline" onClick={onRetry}>
        Reintentar
      </Button>
      <Button size="sm" variant="outline" onClick={onPrintBlank}>
        Imprimir con líneas en blanco
      </Button>
    </div>
  );
}

import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { Link, useLocation, useParams } from "react-router-dom";
import { AxiosError } from "axios";
import { ArrowLeft, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/modules/core/ui/button";
import { buttonVariants } from "@/modules/core/ui/button-variants";
import { ScaleToFit } from "@/modules/core/components/ScaleToFit";
import { PATHS, recordPath } from "@/routes/paths";
import { useSessionStore } from "@/store/useSessionStore";
import { getUserFriendlyError } from "@/modules/core/utils/apiError";
import { usePrintRecord } from "../../hooks/usePrintRecord";
import { filledStepsOf } from "../../utils/filledSteps";
import { toFormValues } from "../../utils/recordForm";
import { PrintStampContext, type PrintStamp } from "./printStamp";
import { useRecord } from "../../hooks/useRecord";
import { RecordLoading } from "../RecordLoading";
import { RecordLoadError } from "../RecordLoadError";
import { RecordNotFound } from "../RecordNotFound";
import { RecordPrintDocument } from "./RecordPrintDocument";
import { NotebookReadError } from "./NotebookReadError";
import { lookupEntry } from "../../notebook/notebookService";
import { withNotebookLock } from "../../notebook/notebookLocks";
import type { NotebookEntry } from "../../notebook/notebookSchema";
import { useNotebookEntry } from "../../notebook/useNotebookEntry";
import { PAGE_CSS, SHEET_WIDTH_PX } from "./printStyle";

/** Fecha local de hoy (`2026-10-05`), para la marca en la vista previa antes de imprimir. */
function todayIso(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Vista preliminar de impresión de una historia (fuera del shell): muestra las hojas A4 tal como
 * saldrán. "Imprimir" registra primero la impresión en el servidor (la primera fija los datos del
 * paciente) y recién entonces abre el diálogo; imprimir por otro medio saca solo un aviso. Las hojas
 * de una historia incompleta llevan la marca de avance con la fecha y el conteo del servidor. Si el
 * dispositivo tiene libreta local para la historia, el navegador completa con ella los datos del
 * paciente al imprimir (copia tomada antes de registrar la impresión); el servidor nunca los recibe y
 * el título del documento no lleva datos del paciente. Fuerza
 * el tema claro mientras está abierta. La coordinación la ve en solo lectura: sin "Imprimir" (no
 * registra impresiones ni fija datos) y "Volver" nunca lleva al formulario.
 */
export function RecordPrintFeature() {
  const { id: param } = useParams();
  const id = param && /^\d+$/.test(param) ? Number(param) : null;
  const record = useRecord(id);
  // De dónde se abrió la vista (listado con su búsqueda o paso del formulario); si no, la historia.
  const returnTo = (useLocation().state as { returnTo?: string } | null)?.returnTo;
  const print = usePrintRecord();
  const readOnly = useSessionStore((s) => s.user?.role === "COORDINATOR");
  // Marca devuelta por el servidor al registrar la impresión (fecha y avance reales).
  const [printed, setPrinted] = useState<PrintStamp | null>(null);
  // Solo mientras el botón abre el diálogo: el CSS muestra las hojas al imprimir.
  const [ready, setReady] = useState(false);
  // Libreta local: la entrada viva para la vista previa, y la copia tomada al imprimir (undefined = viva).
  const accountId = useSessionStore((s) => s.user?.id);
  const live = useNotebookEntry(accountId, id, record.data?.recordNumber);
  const [snapshot, setSnapshot] = useState<NotebookEntry | null | undefined>(undefined);
  const [readFailed, setReadFailed] = useState(false);

  // Nunca queda activo: se quita al terminar o cancelar la impresión y al volver a la página.
  useEffect(() => {
    if (!ready) return;
    const clear = () => setReady(false);
    window.addEventListener("afterprint", clear);
    window.addEventListener("focus", clear);
    return () => {
      window.removeEventListener("afterprint", clear);
      window.removeEventListener("focus", clear);
    };
  }, [ready]);

  // El nombre propuesto del PDF sale del título: genérico, sin datos del paciente ni alias.
  useEffect(() => {
    const previous = document.title;
    document.title = "Historia clínica de ortodoncia";
    return () => {
      document.title = previous;
    };
  }, []);

  // El papel es claro: se quita el tema oscuro mientras la vista está abierta.
  useEffect(() => {
    const root = document.documentElement;
    const wasDark = root.classList.contains("dark");
    root.classList.remove("dark");
    return () => {
      if (wasDark) root.classList.add("dark");
    };
  }, []);

  if (id === null) return <RecordNotFound />;
  if (record.isPending) return <div className="p-6"><RecordLoading /></div>;
  if (record.isError) {
    return (
      <div className="p-6">
        {record.error instanceof AxiosError && record.error.response?.status === 404 ? (
          <RecordNotFound />
        ) : (
          <RecordLoadError error={record.error} onRetry={() => void record.refetch()} />
        )}
      </div>
    );
  }

  const data = record.data;
  const stamp: PrintStamp = printed ?? {
    // Vista previa: el conteo de la historia guardada con el criterio del formulario y la fecha de hoy.
    clinicalFilledSteps: filledStepsOf(toFormValues(data)).filter((step) => step <= 7).length,
    printedOn: todayIso(),
  };

  const liveEntry = live.data?.status === "found" ? live.data.entry : null;
  const entry = snapshot !== undefined ? snapshot : liveEntry;

  /** Registra la impresión con la copia de la libreta ya tomada y abre el diálogo. */
  const registerAndPrint = (copy: NotebookEntry | null) => {
    print.mutate(
      { id: data.id, filledSteps: filledStepsOf(toFormValues(data)) },
      {
        onSuccess: (response) => {
          // Pinta ya la marca del servidor y habilita las hojas; recién entonces abre el diálogo
          // (bloqueante en escritorio) y al volver las deshabilita otra vez.
          flushSync(() => {
            setSnapshot(copy);
            setPrinted({
              clinicalFilledSteps: response.clinicalFilledSteps ?? stamp.clinicalFilledSteps,
              printedOn: response.printedOn,
            });
            setReady(true);
          });
          window.print();
          setReady(false);
          // Reimprimir toma una copia nueva de la libreta.
          setSnapshot(undefined);
        },
        onError: (error) =>
          toast.error(getUserFriendlyError(error), { action: { label: "Reintentar", onClick: () => registerAndPrint(copy) } }),
      },
    );
  };

  /**
   * Toma la copia de la libreta ANTES de registrar la impresión. Si la lectura falla (no por falta de
   * IndexedDB, que simplemente deja las líneas en blanco) no se registra ni se fija nada.
   */
  const onPrint = async () => {
    setReadFailed(false);
    // Bajo el bloqueo de la libreta: un borrado o una importación de otra pestaña espera a esta lectura.
    const result = await withNotebookLock(() => lookupEntry(accountId ?? 0, data.id, data.recordNumber));
    if (result.status === "unavailable" && result.error.kind !== "unavailable") {
      setReadFailed(true);
      return;
    }
    registerAndPrint(result.status === "found" ? result.entry : null);
  };

  const onPrintBlank = () => {
    setReadFailed(false);
    registerAndPrint(null);
  };

  return (
    <main className="min-h-dvh bg-muted print:bg-background" data-print-guard="" data-print-ready={ready ? "" : undefined}>
      <style>{PAGE_CSS}</style>
      {/* En celular: "Volver" e "Imprimir" en una fila y la ayuda debajo. */}
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border bg-background px-4 py-3 sm:px-6 print:hidden">
        <Link
          to={returnTo ?? (readOnly ? PATHS.RECORDS : recordPath(data.id))}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <ArrowLeft className="size-4" aria-hidden="true" /> Volver
        </Link>
        {readOnly ? null : (
          <Button onClick={() => void onPrint()} disabled={print.isPending} className="sm:order-last">
            {print.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Printer className="size-4" aria-hidden="true" />
            )}{" "}
            Imprimir
          </Button>
        )}
        <p className="w-full text-sm text-muted-foreground sm:w-auto sm:flex-1">
          {readOnly
            ? `Historia ${data.recordNumber} en solo lectura: la imprime su autor.`
            : `Vista preliminar de la historia ${data.recordNumber}: revisa las hojas y pulsa Imprimir.`}
        </p>
        {readFailed ? <NotebookReadError onRetry={() => void onPrint()} onPrintBlank={onPrintBlank} /> : null}
        {live.data?.status === "mismatch" ? (
          <p className="w-full text-sm text-destructive">
            La libreta de este dispositivo guarda otra historia con este identificador: no corresponde y se ignora.
          </p>
        ) : null}
      </div>
      <p className="print-guard-notice p-[25mm] text-[14pt]">
        {readOnly ? "La coordinación consulta las historias en solo lectura." : "Usa el botón Imprimir de la vista preliminar."}
      </p>
      {/* Las hojas miden 210 mm: en pantallas más angostas se reducen para caber (al imprimir, A4 real). */}
      <div className="print-sheets">
        <PrintStampContext.Provider value={stamp}>
          <ScaleToFit naturalWidth={SHEET_WIDTH_PX} className="px-2 sm:px-6 print:px-0">
            <RecordPrintDocument record={data} notebook={entry} />
          </ScaleToFit>
        </PrintStampContext.Provider>
      </div>
    </main>
  );
}

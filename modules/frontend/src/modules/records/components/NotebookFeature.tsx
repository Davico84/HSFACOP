import { NotebookExport } from "./NotebookExport";
import { NotebookImport } from "./NotebookImport";
import { NotebookReminder } from "./NotebookReminder";
import { NotebookSettings } from "./NotebookSettings";

/**
 * "Mi libreta": la libreta local de datos del paciente. Explica qué es (vive solo en este dispositivo,
 * el servidor nunca la recibe, el navegador puede borrarla y el papel firmado es el registro oficial) y
 * reúne exportar, importar y los ajustes del dispositivo.
 */
export function NotebookFeature() {
  return (
    <section aria-labelledby="notebook-title" className="flex max-w-3xl flex-col gap-6">
      <header>
        <h1 id="notebook-title" className="text-2xl font-bold">
          Mi libreta
        </h1>
        <p className="text-muted-foreground">
          Los datos del paciente que el sistema ya no guarda (nombre, documento, nacimiento, domicilio y celular) viven aquí,
          solo en este navegador. Se imprimen en la hoja y el servidor nunca los recibe. El navegador puede borrarlos (por
          ejemplo, Safari tras 7 días sin uso) y el papel firmado es el registro oficial: exporta un archivo para respaldarlos.
        </p>
      </header>
      <NotebookReminder />
      <NotebookExport />
      <NotebookImport />
      <NotebookSettings />
    </section>
  );
}

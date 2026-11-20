import type { NotebookDocumentType } from "./notebookSchema";

/** Opciones del tipo de documento de la libreta (el paciente ya no tiene documento en el servidor). */
export const notebookDocumentOptions: { value: NotebookDocumentType; label: string }[] = [
  { value: "DNI", label: "DNI" },
  { value: "FOREIGNER_CARD", label: "Carné de extranjería" },
  { value: "PASSPORT", label: "Pasaporte" },
];

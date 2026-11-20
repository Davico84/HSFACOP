import { z } from "zod";

/**
 * Entrada de la libreta local: los datos del paciente que el servidor ya no guarda (change
 * `add-orthodontic-records-local-patient-notebook`). Vive solo en el navegador, ligada a una cuenta y
 * a una historia. Todos los datos son opcionales (borrador); los campos de texto admiten hasta 200
 * caracteres (el mismo límite que se exige al importar un archivo).
 */
export const NOTEBOOK_FIELD_MAX = 200;
export const NOTEBOOK_SCHEMA_VERSION = 1;

export const NOTEBOOK_DOCUMENT_TYPES = ["DNI", "FOREIGNER_CARD", "PASSPORT"] as const;
export type NotebookDocumentType = (typeof NOTEBOOK_DOCUMENT_TYPES)[number];

export const NOTEBOOK_DOCUMENT_PATTERNS: Record<NotebookDocumentType, { regex: RegExp; message: string }> = {
  DNI: { regex: /^\d{8}$/, message: "El DNI debe tener 8 dígitos." },
  FOREIGNER_CARD: { regex: /^\d{9}$/, message: "El carné de extranjería debe tener 9 dígitos." },
  PASSPORT: { regex: /^\d{6,12}$/, message: "El pasaporte debe tener entre 6 y 12 dígitos." },
};

const text = z.string().trim().max(NOTEBOOK_FIELD_MAX, `Máximo ${NOTEBOOK_FIELD_MAX} caracteres.`);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Usa una fecha válida.");

/** Los datos que escribe el tratante (sin los metadatos que pone la libreta). */
export const notebookFieldsSchema = z
  .object({
    fullName: text,
    documentType: z.enum(NOTEBOOK_DOCUMENT_TYPES).nullable(),
    documentNumber: text,
    birthDate: isoDate.or(z.literal("")),
    birthPlace: text,
    address: text,
    phone: text,
    signerName: text,
    signerRelationship: text,
  })
  .superRefine((fields, ctx) => {
    const number = fields.documentNumber;
    if (!fields.documentType && number) {
      ctx.addIssue({ code: "custom", path: ["documentType"], message: "Indica el tipo de documento." });
    } else if (fields.documentType && !number) {
      ctx.addIssue({ code: "custom", path: ["documentNumber"], message: "Indica el número del documento." });
    } else if (fields.documentType && !NOTEBOOK_DOCUMENT_PATTERNS[fields.documentType].regex.test(number)) {
      ctx.addIssue({ code: "custom", path: ["documentNumber"], message: NOTEBOOK_DOCUMENT_PATTERNS[fields.documentType].message });
    }
  });

export type NotebookFields = z.infer<typeof notebookFieldsSchema>;

export const EMPTY_NOTEBOOK_FIELDS: NotebookFields = {
  fullName: "",
  documentType: null,
  documentNumber: "",
  birthDate: "",
  birthPlace: "",
  address: "",
  phone: "",
  signerName: "",
  signerRelationship: "",
};

/** Una entrada guardada: los datos más lo que la liga a su cuenta e historia y ordena las versiones. */
export const notebookEntrySchema = z
  .object({
    accountId: z.number().int().positive(),
    recordId: z.number().int().positive(),
    /** El `AEO-NNNN` de la historia: protege contra bases restauradas que reutilicen identificadores. */
    recordNumber: z.string().regex(/^AEO-\d{4}$/),
    /** Sube en cada guardado; ordena las versiones al importar (nunca el reloj del dispositivo). */
    revision: z.number().int().min(1),
    /** Solo informativo. */
    updatedAt: z.string().max(40),
    exportedAt: z.string().max(40).nullable(),
    schemaVersion: z.literal(NOTEBOOK_SCHEMA_VERSION),
  })
  .and(notebookFieldsSchema);

export type NotebookEntry = z.infer<typeof notebookEntrySchema>;

/** Los campos de una entrada, sin metadatos (para llenar el formulario). */
export function fieldsOf(entry: NotebookEntry | null | undefined): NotebookFields {
  if (!entry) return { ...EMPTY_NOTEBOOK_FIELDS };
  return {
    fullName: entry.fullName,
    documentType: entry.documentType,
    documentNumber: entry.documentNumber,
    birthDate: entry.birthDate,
    birthPlace: entry.birthPlace,
    address: entry.address,
    phone: entry.phone,
    signerName: entry.signerName,
    signerRelationship: entry.signerRelationship,
  };
}

/** ¿La entrada no tiene ningún dato? */
export function isEmptyFields(fields: NotebookFields): boolean {
  return Object.entries(fields).every(([, value]) => value === "" || value === null);
}

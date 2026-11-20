import type {
  CreateRecordRequest,
  RecordContent,
  RecordResponse,
  UpdateRecordRequest,
} from "@/modules/core/services/generated/model";
import type { RecordFormValues } from "../schemas/record";
import { completeValues } from "../schemas/recordDefaults";
import { normalizeAlias } from "./alias";

/** Contenido vacío (todas las secciones presentes), como lo devuelve el backend para una historia nueva. */
export function emptyContent(): RecordContent {
  return {
    anamnesis: {},
    facial: {},
    functional: { suckingHabitTypes: ["NONE"] },
    occlusal: {},
    models: { transversal: { walaToEv: {} }, moyers: { lowerIncisors: {}, availableSpace: {} }, nance: { upperWidths: {}, lowerWidths: {} }, bolton: { firstMolars: {}, incisors: {} }, tanaka: {}, wolford: {} },
    radiographic: {},
    diagnosis: { problemList: [], treatmentGoals: [] },
    signatures: {},
  };
}

/** Valores iniciales de una historia nueva; el tratante se propone con el nombre del usuario. */
export function emptyRecordValues(treatingDentist?: string): RecordFormValues {
  return completeValues({ recordNumber: "", treatingDentist: treatingDentist ?? "", patientAlias: "", content: emptyContent() });
}

/**
 * Respuesta del servidor → valores del formulario, con TODOS los campos presentes (los `null`
 * del JSON pasan a su valor vacío) y sin los campos que no se editan (el número sí se edita). Valores iniciales
 * completos: montar un paso no cuenta como cambio.
 */
export function toFormValues(record: RecordResponse): RecordFormValues {
  const clean = withoutNulls(record) as RecordResponse;
  const values = {
    recordNumber: clean.recordNumber,
    treatingDentist: clean.treatingDentist,
    patientAlias: clean.patientAlias,
    patientSex: clean.patientSex,
    patientAge: clean.patientAge,
    // Un alias ya guardado no pide confirmación de nuevo; solo el que se escribe.
    aliasConfirmed: true,
    treatmentStartDate: clean.treatmentStartDate,
    content: clean.content,
  };
  return completeValues(values);
}

/**
 * Valores del formulario → cuerpo del POST (sin vacíos: el servidor los trata como nulos), con los
 * pasos que tienen datos.
 */
export function toCreateRequest(values: RecordFormValues, filledSteps?: number[]): CreateRecordRequest {
  return { ...(requestBody(values) as CreateRecordRequest), ...(filledSteps ? { filledSteps } : {}) };
}

/** Valores del formulario + versión cargada → cuerpo del PUT. */
export function toUpdateRequest(
  values: RecordFormValues,
  version: number,
  lastStep?: number,
  filledSteps?: number[],
): UpdateRecordRequest {
  return {
    ...(requestBody(values) as CreateRecordRequest),
    version,
    ...(lastStep ? { lastStep } : {}),
    ...(filledSteps ? { filledSteps } : {}),
  };
}

/** Copia profunda sin `null` (los arrays se conservan). */
function withoutNulls(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutNulls);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).filter(([, v]) => v !== null).map(([k, v]) => [k, withoutNulls(v)]),
    );
  }
  return value;
}

/**
 * Cuerpo de la petición: sin vacíos, con el alias normalizado y sin `aliasConfirmed`, que es solo
 * del formulario (el servidor rechazaría o ignoraría un campo que no conoce).
 */
function requestBody(values: RecordFormValues): unknown {
  const rest = { ...values };
  delete rest.aliasConfirmed;
  return withoutEmpty({ ...rest, patientAlias: rest.patientAlias ? normalizeAlias(rest.patientAlias) : rest.patientAlias });
}

/** Copia profunda sin `null`, `undefined` ni cadenas vacías. */
function withoutEmpty(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutEmpty);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== null && v !== undefined && v !== "")
        .map(([k, v]) => [k, withoutEmpty(v)]),
    );
  }
  return value;
}

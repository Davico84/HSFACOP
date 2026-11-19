import { z } from "zod";
import type { UpdateProfileRequest, UpdateProfileRequestDocumentType } from "@/modules/core/services/generated/model";
import type { AccountDocumentType } from "../config/documentTypes";

/** Formato del documento de la cuenta por tipo (paridad con `ContactFields`); el paciente ya no tiene documento. */
export const DOCUMENT_PATTERNS: Record<AccountDocumentType, { regex: RegExp; message: string }> = {
  DNI: { regex: /^\d{8}$/, message: "El DNI debe tener 8 dígitos." },
  FOREIGNER_CARD: { regex: /^\d{9}$/, message: "El carné de extranjería debe tener 9 dígitos." },
  PASSPORT: { regex: /^\d{6,12}$/, message: "El pasaporte debe tener entre 6 y 12 dígitos." },
};

/**
 * Datos de contacto e identificación de una cuenta (registro y "Mis datos"), en paridad con
 * `ContactFields` del backend: todos opcionales; celular de 9 dígitos que empieza con 9, documento
 * con tipo y número del formato de ese tipo (siempre juntos) y COP de 1 a 6 dígitos. En el
 * formulario lo vacío es `""`; `contactPayload` lo envía como `null`.
 */
export const contactFields = {
  phone: z.string().trim(),
  documentType: z.string(),
  documentNumber: z.string().trim(),
  copNumber: z.string().trim(),
};

const PHONE = /^9\d{8}$/;
const COP = /^\d{1,6}$/;

interface ContactInput {
  phone: string;
  documentType: string;
  documentNumber: string;
  copNumber: string;
}

/** Reglas entre campos; cada error va a su campo. */
export function checkContact(v: ContactInput, ctx: z.RefinementCtx) {
  if (v.phone && !PHONE.test(v.phone)) {
    ctx.addIssue({ code: "custom", path: ["phone"], message: "El celular debe tener 9 dígitos y empezar con 9." });
  }
  const type = v.documentType as UpdateProfileRequestDocumentType | "";
  if (!type && v.documentNumber) {
    ctx.addIssue({ code: "custom", path: ["documentType"], message: "Indica el tipo de documento." });
  } else if (type && !v.documentNumber) {
    ctx.addIssue({ code: "custom", path: ["documentNumber"], message: "Indica el número del documento." });
  } else if (type && !DOCUMENT_PATTERNS[type].regex.test(v.documentNumber)) {
    ctx.addIssue({ code: "custom", path: ["documentNumber"], message: DOCUMENT_PATTERNS[type].message });
  }
  if (v.copNumber && !COP.test(v.copNumber)) {
    ctx.addIssue({ code: "custom", path: ["copNumber"], message: "El COP debe tener entre 1 y 6 dígitos." });
  }
}

export const contactSchema = z.object(contactFields).superRefine(checkContact);

export type ContactValues = z.infer<typeof contactSchema>;

/** Valores del formulario desde la API (nulo = vacío). */
export function contactValues(data: Partial<Record<keyof ContactInput, string | null | undefined>>): ContactValues {
  return {
    phone: data.phone ?? "",
    documentType: data.documentType ?? "",
    documentNumber: data.documentNumber ?? "",
    copNumber: data.copNumber ?? "",
  };
}

/** Cuerpo para la API: vacío = `null` (quitar o no enviar el dato). */
export function contactPayload(v: ContactValues): UpdateProfileRequest {
  return {
    phone: v.phone || null,
    documentType: (v.documentType || null) as UpdateProfileRequestDocumentType,
    documentNumber: v.documentNumber || null,
    copNumber: v.copNumber || null,
  };
}

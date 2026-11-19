import type { RegisterRequestDocumentType } from "@/modules/core/services/generated/model";

/** Tipo de documento de una cuenta (el paciente ya no tiene documento en el sistema). */
export type AccountDocumentType = Exclude<RegisterRequestDocumentType, null>;

export const documentTypeOptions: { value: AccountDocumentType; label: string }[] = [
  { value: "DNI", label: "DNI" },
  { value: "FOREIGNER_CARD", label: "Carné de extranjería" },
  { value: "PASSPORT", label: "Pasaporte" },
];

const SHORT: Record<AccountDocumentType, string> = { DNI: "DNI", FOREIGNER_CARD: "CE", PASSPORT: "Pasaporte" };

/** "DNI 74125896", "CE 001234567", "Pasaporte 12345678"; vacío sin documento. */
export function formatDocument(type: RegisterRequestDocumentType | undefined, number: string | null | undefined): string {
  if (!type || !number) return "";
  return `${SHORT[type]} ${number}`;
}

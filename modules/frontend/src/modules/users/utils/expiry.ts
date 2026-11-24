import type { ListUsersExpiry } from "@/modules/core/services/generated/model";

/** Filtro de vencimiento del listado, tal como viaja en la URL (`?vencimiento=`). */
export type ExpiryFilterParam = "por-vencer" | "vencidas";

export const EXPIRY_FILTER_LABEL: Record<ExpiryFilterParam, string> = {
  "por-vencer": "Por vencer (30 días)",
  vencidas: "Vencidas",
};

/** Valor de la URL → filtro; lo desconocido se ignora (sin filtro). */
export function parseExpiryFilter(raw: string | null): ExpiryFilterParam | null {
  return raw === "por-vencer" || raw === "vencidas" ? raw : null;
}

/** Filtro de la URL → parámetro del contrato (`expiry`). */
export function toApiExpiry(filter: ExpiryFilterParam | null): ListUsersExpiry | undefined {
  if (filter === "por-vencer") return "SOON";
  if (filter === "vencidas") return "EXPIRED";
  return undefined;
}

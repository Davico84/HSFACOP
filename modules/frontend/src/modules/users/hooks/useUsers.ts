import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { ListUsersExpiry } from "@/modules/core/services/generated/model";
import { listUsers } from "@/modules/core/services/generated/users";
import { USERS_PAGE_SIZE, userKeys } from "./userKeys";

/**
 * Página del listado de cuentas (solo ADMIN). `keepPreviousData`: al cambiar de página la
 * tabla anterior sigue visible mientras llega la nueva (`isPlaceholderData`). `expiry` filtra las
 * cuentas activas por vencer o ya vencidas.
 */
export function useUsers(page: number, expiry?: ListUsersExpiry) {
  const params = { page, size: USERS_PAGE_SIZE, ...(expiry ? { expiry } : {}) };
  return useQuery({
    queryKey: userKeys.list(params),
    queryFn: () => listUsers(params),
    placeholderData: keepPreviousData,
  });
}

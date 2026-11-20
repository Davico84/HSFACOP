import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { listRecords, searchRecords } from "@/modules/core/services/generated/orthodontic-records";
import type { SearchPlan } from "../notebook/localSearch";
import { RECORDS_PAGE_SIZE, recordKeys } from "./recordKeys";

/**
 * Página del listado de historias (USER: las suyas; ADMIN: todas; COORDINATOR: las de sus turmas).
 * Según el plan de búsqueda: sin texto se usa el listado `GET`; con texto de alias o número, `POST`
 * con el texto en el cuerpo; con coincidencias de la libreta local, `POST` con los identificadores en
 * el cuerpo y sin el texto. Nunca viaja nada en la URL. `cohortId` filtra la coordinación por una de
 * sus turmas. Con el plan `wait` (leyendo la libreta) o `none` no consulta.
 */
export function useRecords(plan: SearchPlan, page: number, cohortId: number | null = null) {
  const search =
    plan.kind === "text" ? { q: plan.q } : plan.kind === "ids" ? { ids: plan.ids } : { q: "" };
  const params = { ...search, page, size: RECORDS_PAGE_SIZE, cohortId };
  return useQuery({
    queryKey: recordKeys.list(params),
    queryFn: () => {
      const paging = { page, size: RECORDS_PAGE_SIZE, cohortId: cohortId ?? undefined };
      if (plan.kind === "ids") return searchRecords({ recordIds: plan.ids }, paging);
      if (plan.kind === "text") return searchRecords({ q: plan.q }, paging);
      return listRecords(paging);
    },
    enabled: plan.kind !== "wait" && plan.kind !== "none",
    placeholderData: keepPreviousData,
  });
}

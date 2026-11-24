import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { renewUserExpiry } from "@/modules/core/services/generated/users";
import { formatCivilDate } from "@/modules/core/utils/civilDate";
import { getUserFriendlyError } from "@/modules/core/utils/apiError";
import { dashboardKeys } from "@/modules/dashboard/hooks/dashboardKeys";
import { userKeys } from "./userKeys";

/** Renovar 12 meses el acceso de una cuenta; al terminar se recarga el listado (la fila muestra la nueva fecha). */
export function useRenewExpiry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => renewUserExpiry(id),
    onSuccess: (user) =>
      toast.success(
        user.expiresOn
          ? `Acceso de ${user.fullName} renovado hasta el ${formatCivilDate(user.expiresOn)}`
          : `Acceso de ${user.fullName} renovado`,
      ),
    onError: (error) => toast.error(getUserFriendlyError(error)),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
      return queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
  });
}

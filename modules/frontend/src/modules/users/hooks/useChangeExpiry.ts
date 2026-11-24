import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { changeUserExpiry } from "@/modules/core/services/generated/users";
import { formatCivilDate } from "@/modules/core/utils/civilDate";
import { getUserFriendlyError } from "@/modules/core/utils/apiError";
import { dashboardKeys } from "@/modules/dashboard/hooks/dashboardKeys";
import { userKeys } from "./userKeys";

export interface ChangeExpiryInput {
  id: number;
  /** Último día con acceso completo (fecha civil `YYYY-MM-DD`). */
  expiresOn: string;
}

/** Fijar a mano el último día de acceso de una cuenta; al terminar se recarga el listado. */
export function useChangeExpiry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, expiresOn }: ChangeExpiryInput) => changeUserExpiry(id, { expiresOn }),
    onSuccess: (user) =>
      toast.success(
        user.expiresOn
          ? `Acceso de ${user.fullName} hasta el ${formatCivilDate(user.expiresOn)}`
          : `Vencimiento de ${user.fullName} actualizado`,
      ),
    onError: (error) => toast.error(getUserFriendlyError(error)),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
      return queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
  });
}

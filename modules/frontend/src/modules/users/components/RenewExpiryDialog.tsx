import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/modules/core/ui/alert-dialog";
import type { UserSummaryResponse } from "@/modules/core/services/generated/model";

interface RenewExpiryDialogProps {
  /** Cuenta a renovar; `null` = cerrado. */
  user: UserSummaryResponse | null;
  onConfirm: (user: UserSummaryResponse) => void;
  onCancel: () => void;
}

/** Confirmación antes de renovar 12 meses el acceso de una cuenta. */
export function RenewExpiryDialog({ user, onConfirm, onCancel }: RenewExpiryDialogProps) {
  return (
    <AlertDialog open={user !== null} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Renovar el acceso de {user?.fullName}?</AlertDialogTitle>
          <AlertDialogDescription>
            {user?.expired
              ? "Su acceso vuelve a ser completo por 12 meses desde hoy."
              : "Se suman 12 meses a su fecha de vencimiento actual: no pierde los días que le quedaban."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={() => user && onConfirm(user)}>Renovar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

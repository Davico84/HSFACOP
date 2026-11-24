import { Dialog, DialogContent } from "@/modules/core/ui/dialog";
import type { UserSummaryResponse } from "@/modules/core/services/generated/model";
import { ChangeExpiryForm } from "./ChangeExpiryForm";

export interface ChangeExpiryDialogProps {
  /** Cuenta a la que se le fija la fecha; `null` = cerrado. */
  user: UserSummaryResponse | null;
  onConfirm: (user: UserSummaryResponse, expiresOn: string) => void;
  onCancel: () => void;
}

/** Fijar a mano el último día de acceso de una cuenta (fecha civil de Lima). */
export function ChangeExpiryDialog({ user, onConfirm, onCancel }: ChangeExpiryDialogProps) {
  return (
    <Dialog open={user !== null} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        {/* `key`: cada apertura empieza con la fecha actual de esa cuenta. */}
        {user ? <ChangeExpiryForm key={user.id} user={user} onConfirm={onConfirm} /> : null}
      </DialogContent>
    </Dialog>
  );
}

import { Badge } from "@/modules/core/ui/badge";
import type { UserSummaryResponse } from "@/modules/core/services/generated/model";
import { formatCivilDate } from "@/modules/core/utils/civilDate";

/**
 * Vencimiento de una cuenta: "Vence el …" o "Vencida" (con texto, no solo color). Las cuentas ADMIN no
 * vencen.
 */
export function UserExpiryCell({ user }: { user: UserSummaryResponse }) {
  if (!user.expiresOn) return <span className="text-sm text-muted-foreground">No vence</span>;
  const date = formatCivilDate(user.expiresOn);
  if (user.expired) {
    return (
      <div className="flex flex-col items-start gap-1">
        <Badge variant="destructive">Vencida</Badge>
        <span className="text-xs text-muted-foreground">Desde el {date}</span>
      </div>
    );
  }
  return <span className="text-sm tabular-nums">Vence el {date}</span>;
}

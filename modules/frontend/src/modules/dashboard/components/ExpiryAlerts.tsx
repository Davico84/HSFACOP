import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Card } from "@/modules/core/ui/card";
import { Badge } from "@/modules/core/ui/badge";
import type { AdminDashboardUsers } from "@/modules/core/services/generated/model";
import { PATHS } from "@/routes/paths";

interface ExpiryAlertsProps {
  users: AdminDashboardUsers;
}

const LINK_CLASS =
  "inline-flex items-center gap-1 rounded-sm text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring";

/** Cuentas activas que vencen en 30 días o ya vencieron, con enlace a "Usuarios" ya filtrado. */
export function ExpiryAlerts({ users }: ExpiryAlertsProps) {
  const { expiringSoon, expired } = users;
  return (
    <Card className="flex flex-col gap-4 p-5">
      <h2 className="font-semibold">Accesos por renovar</h2>
      {expiringSoon === 0 && expired === 0 ? (
        <p className="text-sm text-muted-foreground">No hay cuentas por renovar.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {expired > 0 ? (
            <li className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
              <span className="flex items-center gap-2">
                <Badge variant="destructive">Vencidas</Badge>
                <span className="tabular-nums">{expired}</span>
              </span>
              <Link to={`${PATHS.USERS}?vencimiento=vencidas`} className={LINK_CLASS}>
                Ver vencidas <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </li>
          ) : null}
          {expiringSoon > 0 ? (
            <li className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
              <span className="flex items-center gap-2">
                <span className="text-sm">Vencen en 30 días</span>
                <span className="tabular-nums">{expiringSoon}</span>
              </span>
              <Link to={`${PATHS.USERS}?vencimiento=por-vencer`} className={LINK_CLASS}>
                Ver por vencer <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </li>
          ) : null}
        </ul>
      )}
    </Card>
  );
}

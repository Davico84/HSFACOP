import { Users } from "lucide-react";
import { Button } from "@/modules/core/ui/button";

interface UsersEmptyStateProps {
  /** Si no es la primera página, ofrece volver a la anterior (la página quedó vacía). */
  onBack?: () => void;
  /** Hay un filtro de vencimiento activo: "vacío" significa que ninguna cuenta lo cumple. */
  filtered?: boolean;
}

export function UsersEmptyState({ onBack, filtered = false }: UsersEmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <Users className="size-10 text-muted-foreground" aria-hidden="true" />
      <p className="text-muted-foreground">{onBack ? "Esta página ya no tiene cuentas." : filtered ? "Ninguna cuenta cumple ese filtro." : "Todavía no hay cuentas."}</p>
      {onBack ? (
        <Button variant="outline" size="sm" onClick={onBack}>
          Volver a la página anterior
        </Button>
      ) : null}
    </div>
  );
}

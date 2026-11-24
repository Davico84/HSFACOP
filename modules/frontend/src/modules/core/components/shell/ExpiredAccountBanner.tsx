import { Lock } from "lucide-react";
import { formatCivilDate } from "@/modules/core/utils/civilDate";

interface ExpiredAccountBannerProps {
  /** Último día con acceso completo (fecha civil); sin él no se menciona la fecha. */
  expiresOn?: string | null;
}

/** Aviso persistente del shell cuando la cuenta venció. Antes del vencimiento no se muestra nada. */
export function ExpiredAccountBanner({ expiresOn }: ExpiredAccountBannerProps) {
  return (
    <div
      role="status"
      className="flex items-start gap-3 border-b border-border bg-muted px-4 py-3 text-sm sm:px-6 lg:px-8"
    >
      <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <p>
        <strong className="font-semibold">
          Tu acceso venció{expiresOn ? ` el ${formatCivilDate(expiresOn)}` : ""}.
        </strong>{" "}
        Puedes ver e imprimir tus historias; para seguir editando, pide la renovación al administrador.
      </p>
    </div>
  );
}

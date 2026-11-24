import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/modules/core/ui/button-variants";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/modules/core/ui/tooltip";
import { useReadOnly } from "@/modules/core/hooks/useReadOnly";
import { PATHS } from "@/routes/paths";
import { useRecordQuota } from "../hooks/useRecordQuota";
import { quotaReachedMessage } from "../utils/quota";

/**
 * "Nueva historia": con el cupo lleno queda deshabilitado (un `span` enfocable hace de disparador
 * del tooltip, porque un control deshabilitado no recibe el puntero). El aviso visible lo muestra
 * `RecordQuotaNotice`. Con la cuenta vencida no se muestra: el aviso del shell explica el motivo.
 */
export function NewRecordLink() {
  const readOnly = useReadOnly();
  const quota = useRecordQuota();
  if (readOnly) return null;
  const reached = quota.data?.reached === true && quota.data.limit != null;
  if (!reached) {
    return (
      <Link to={PATHS.RECORD_NEW} className={buttonVariants()}>
        <Plus className="size-4" aria-hidden="true" /> Nueva historia
      </Link>
    );
  }
  const message = quotaReachedMessage(quota.data!.limit!);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} aria-describedby={undefined} className="inline-flex rounded-md focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring">
          <span role="link" aria-disabled="true" aria-label={`Nueva historia (no disponible: ${message})`} className={buttonVariants({ className: "pointer-events-none opacity-50" })}>
            <Plus className="size-4" aria-hidden="true" /> Nueva historia
          </span>
        </span>
      </TooltipTrigger>
      <TooltipContent>{message}</TooltipContent>
    </Tooltip>
  );
}

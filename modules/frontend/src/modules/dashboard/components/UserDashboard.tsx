import { CheckCircle2, Gauge } from "lucide-react";
import { FieldHint } from "@/modules/core/components/form/FieldHint";
import { StatCard } from "@/modules/core/components/StatCard";
import type { UserDashboardResponse } from "@/modules/core/services/generated/model";
import { quotaReachedMessage } from "@/modules/records/utils/quota";
import { DashboardEmpty } from "./DashboardEmpty";
import { ResumeList } from "./ResumeList";

interface UserDashboardProps {
  data: UserDashboardResponse;
}

/** Inicio del tratante: primero qué retomar; debajo, su cupo y cuántas historias completó. */
export function UserDashboard({ data }: UserDashboardProps) {
  const { records, quota, completeness, resume } = data;
  if (records.total === 0) return <DashboardEmpty />;
  const pending = completeness.inProgress + completeness.notComputed;
  return (
    <div className="flex flex-col gap-6">
      {quota.reached && quota.limit != null ? <FieldHint>{quotaReachedMessage(quota.limit)}</FieldHint> : null}
      <ResumeList items={resume} />
      <section aria-labelledby="kpis-title" className="flex flex-col gap-2">
        <h2 id="kpis-title" className="sr-only">
          Indicadores
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <StatCard label="Cupo" value={quota.limit == null ? "Sin límite" : `${quota.used} de ${quota.limit}`} icon={Gauge} />
          <StatCard
            label="Completas"
            value={String(completeness.complete)}
            hint={`${pending} por terminar`}
            icon={CheckCircle2}
          />
        </div>
      </section>
    </div>
  );
}

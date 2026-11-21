import { Card } from "@/modules/core/ui/card";
import type { DashboardResumeItem } from "@/modules/core/services/generated/model";
import { ResumeRow } from "./ResumeRow";

interface ResumeListProps {
  items: DashboardResumeItem[];
}

/** "Para retomar": historias no completas más recientes; es lo primero del Inicio del tratante. */
export function ResumeList({ items }: ResumeListProps) {
  return (
    <Card className="flex flex-col gap-4 p-5">
      <h2 className="font-semibold">Para retomar</h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tienes historias pendientes: todas tienen los 7 pasos clínicos.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {items.map((item) => (
            <ResumeRow key={item.id} item={item} />
          ))}
        </ul>
      )}
    </Card>
  );
}

import { NewRecordLink } from "@/modules/records/components/NewRecordLink";
import { useMyDashboard } from "../hooks/useMyDashboard";

/**
 * "Nueva historia" junto al saludo del tratante. Solo cuando ya tiene historias: sin ninguna, la
 * invitación de `DashboardEmpty` ya trae el botón. Comparte la consulta del Inicio (sin otra petición).
 * Con el cupo lleno `NewRecordLink` queda deshabilitado y el aviso lo muestra `UserDashboard`.
 */
export function DashboardNewRecord() {
  const query = useMyDashboard(true);
  if (!query.data || query.data.records.total === 0) return null;
  return (
    <div className="w-full sm:w-auto [&_a]:w-full sm:[&_a]:w-auto">
      <NewRecordLink />
    </div>
  );
}

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/modules/core/ui/select";
import { EXPIRY_FILTER_LABEL, parseExpiryFilter, type ExpiryFilterParam } from "../utils/expiry";

const ALL = "all";

interface UsersExpiryFilterProps {
  value: ExpiryFilterParam | null;
  onChange: (filter: ExpiryFilterParam | null) => void;
}

/** Filtro del listado por vencimiento (solo cuentas activas): por vencer en 30 días o vencidas. */
export function UsersExpiryFilter({ value, onChange }: UsersExpiryFilterProps) {
  return (
    <Select value={value ?? ALL} onValueChange={(next) => onChange(parseExpiryFilter(next))}>
      <SelectTrigger aria-label="Filtrar por vencimiento" className="w-full sm:w-56">
        <SelectValue placeholder="Todas las cuentas" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>Todas las cuentas</SelectItem>
        <SelectItem value="por-vencer">{EXPIRY_FILTER_LABEL["por-vencer"]}</SelectItem>
        <SelectItem value="vencidas">{EXPIRY_FILTER_LABEL.vencidas}</SelectItem>
      </SelectContent>
    </Select>
  );
}

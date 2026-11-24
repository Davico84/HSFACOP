import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Layers, Loader2 } from "lucide-react";
import { Button } from "@/modules/core/ui/button";
import type { UserSummaryResponse } from "@/modules/core/services/generated/model";
import { getUserFriendlyError } from "@/modules/core/utils/apiError";
import { useUsers } from "../hooks/useUsers";
import { useChangeUserStatus } from "../hooks/useChangeUserStatus";
import { useChangeRecordQuota } from "../hooks/useChangeRecordQuota";
import { useRenewExpiry } from "../hooks/useRenewExpiry";
import { useChangeExpiry } from "../hooks/useChangeExpiry";
import { parseExpiryFilter, toApiExpiry, type ExpiryFilterParam } from "../utils/expiry";
import { UsersTable } from "./UsersTable";
import { UsersPagination } from "./UsersPagination";
import { UsersEmptyState } from "./UsersEmptyState";
import { UsersExpiryFilter } from "./UsersExpiryFilter";
import { RenewExpiryDialog } from "./RenewExpiryDialog";
import { ChangeExpiryDialog } from "./ChangeExpiryDialog";
import { ChangeStatusDialog } from "./ChangeStatusDialog";
import { RecordQuotaDialog } from "./RecordQuotaDialog";
import { CoordinationDialog } from "./CoordinationDialog";
import { RevertToStudentDialog } from "./RevertToStudentDialog";
import { UserContactDialog } from "./UserContactDialog";
import { ConfirmPasswordResetDialog } from "./ConfirmPasswordResetDialog";
import { ResetLinkDialog, type ResetLink } from "./ResetLinkDialog";
import { useCreatePasswordReset } from "../hooks/useCreatePasswordReset";
import { useChangeUserRole } from "../hooks/useChangeUserRole";
import { useCohorts } from "@/modules/cohorts/hooks/useCohorts";
import { CohortsDialog } from "@/modules/cohorts/components/CohortsDialog";

/**
 * Gestión de cuentas (solo ADMIN): listado paginado, activar/deshabilitar cuentas, cupo de historias
 * y turma de los alumnos, cuentas de coordinación con sus turmas y gestión de turmas.
 */
export function UsersFeature() {
  const [page, setPage] = useState(0);
  const [target, setTarget] = useState<UserSummaryResponse | null>(null);
  // El filtro vive en la URL: el enlace de Inicio ("vencidas") abre el listado ya filtrado.
  const [searchParams, setSearchParams] = useSearchParams();
  const expiryFilter = parseExpiryFilter(searchParams.get("vencimiento"));
  const users = useUsers(page, toApiExpiry(expiryFilter));
  const change = useChangeUserStatus();
  const pendingId = change.isPending ? (change.variables?.id ?? null) : null;
  const [quotaTarget, setQuotaTarget] = useState<UserSummaryResponse | null>(null);
  const changeQuota = useChangeRecordQuota();
  const quotaPendingId = changeQuota.isPending ? (changeQuota.variables?.id ?? null) : null;
  const cohorts = useCohorts();
  const [coordinationTarget, setCoordinationTarget] = useState<UserSummaryResponse | null>(null);
  const [revertTarget, setRevertTarget] = useState<UserSummaryResponse | null>(null);
  const [cohortsOpen, setCohortsOpen] = useState(false);
  const [contactTarget, setContactTarget] = useState<UserSummaryResponse | null>(null);
  const [resetTarget, setResetTarget] = useState<UserSummaryResponse | null>(null);
  const [resetLink, setResetLink] = useState<ResetLink | null>(null);
  const createReset = useCreatePasswordReset();
  const [renewTarget, setRenewTarget] = useState<UserSummaryResponse | null>(null);
  const [expiryTarget, setExpiryTarget] = useState<UserSummaryResponse | null>(null);
  const renew = useRenewExpiry();
  const changeExpiry = useChangeExpiry();
  const expiryPendingId =
    (renew.isPending ? renew.variables : null) ?? (changeExpiry.isPending ? (changeExpiry.variables?.id ?? null) : null);

  const onFilterChange = (filter: ExpiryFilterParam | null) => {
    setPage(0);
    setSearchParams(filter ? { vencimiento: filter } : {}, { replace: true });
  };
  const confirmRenew = (user: UserSummaryResponse) => {
    setRenewTarget(null);
    renew.mutate(user.id);
  };
  const confirmExpiry = (user: UserSummaryResponse, expiresOn: string) => {
    setExpiryTarget(null);
    changeExpiry.mutate({ id: user.id, expiresOn });
  };

  const confirmReset = (user: UserSummaryResponse) => {
    setResetTarget(null);
    createReset.mutate(user.id, {
      onSuccess: (link) => setResetLink({ fullName: user.fullName, token: link.token, expiresAt: link.expiresAt }),
    });
  };
  const changeRole = useChangeUserRole();
  const rolePendingId = changeRole.isPending ? (changeRole.variables?.id ?? null) : null;

  const confirm = (user: UserSummaryResponse) => {
    setTarget(null);
    change.mutate({ id: user.id, status: user.status === "ACTIVE" ? "DISABLED" : "ACTIVE" });
  };

  const confirmQuota = (user: UserSummaryResponse, recordQuota: number | null) => {
    setQuotaTarget(null);
    changeQuota.mutate({ id: user.id, recordQuota });
  };

  const confirmCoordination = (user: UserSummaryResponse, cohortIds: number[]) => {
    setCoordinationTarget(null);
    changeRole.mutate({ id: user.id, role: "COORDINATOR", cohortIds });
  };

  const confirmRevert = (user: UserSummaryResponse) => {
    setRevertTarget(null);
    changeRole.mutate({ id: user.id, role: "USER", cohortIds: [] });
  };

  let content;
  if (users.isPending) {
    content = (
      <p className="flex items-center gap-2 text-muted-foreground" role="status">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Cargando usuarios…
      </p>
    );
  } else if (users.isError) {
    content = (
      <div role="alert" className="flex flex-col items-start gap-3">
        <p className="text-destructive">{getUserFriendlyError(users.error)}</p>
        <Button variant="outline" size="sm" onClick={() => void users.refetch()}>
          Reintentar
        </Button>
      </div>
    );
  } else if (users.data.content.length === 0) {
    content = (
      <UsersEmptyState
        filtered={expiryFilter !== null}
        onBack={page > 0 ? () => setPage((p) => p - 1) : undefined}
      />
    );
  } else {
    content = (
      <>
        <UsersTable
          users={users.data.content}
          cohorts={cohorts.data ?? []}
          pendingId={pendingId}
          quotaPendingId={quotaPendingId}
          rolePendingId={rolePendingId}
          expiryPendingId={expiryPendingId}
          onRequestChange={setTarget}
          onRequestQuota={setQuotaTarget}
          onRequestCoordination={setCoordinationTarget}
          onRequestRevert={setRevertTarget}
          onRequestContact={setContactTarget}
          onRequestPasswordReset={setResetTarget}
          onRequestRenew={setRenewTarget}
          onRequestExpiry={setExpiryTarget}
        />
        <UsersPagination
          page={users.data.page}
          totalPages={users.data.totalPages}
          last={users.data.last}
          loading={users.isPlaceholderData}
          onChange={setPage}
        />
      </>
    );
  }

  return (
    <section aria-labelledby="users-title" className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 id="users-title" className="text-2xl font-bold">
            Usuarios
          </h1>
          <p className="text-muted-foreground">
            Activa o deshabilita las cuentas, fija cuántas historias puede crear cada alumno, asígnale su turma y da
            acceso de coordinación.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <UsersExpiryFilter value={expiryFilter} onChange={onFilterChange} />
          <Button variant="outline" onClick={() => setCohortsOpen(true)}>
            <Layers className="size-4" aria-hidden="true" /> Turmas
          </Button>
        </div>
      </header>
      {content}
      <ChangeStatusDialog user={target} onConfirm={confirm} onCancel={() => setTarget(null)} />
      <RecordQuotaDialog user={quotaTarget} onConfirm={confirmQuota} onCancel={() => setQuotaTarget(null)} />
      <CoordinationDialog
        user={coordinationTarget}
        cohorts={cohorts.data ?? []}
        onConfirm={confirmCoordination}
        onCancel={() => setCoordinationTarget(null)}
      />
      <RevertToStudentDialog user={revertTarget} onConfirm={confirmRevert} onCancel={() => setRevertTarget(null)} />
      <CohortsDialog open={cohortsOpen} onOpenChange={setCohortsOpen} />
      <UserContactDialog user={contactTarget} onClose={() => setContactTarget(null)} />
      <ConfirmPasswordResetDialog user={resetTarget} onConfirm={confirmReset} onCancel={() => setResetTarget(null)} />
      <ResetLinkDialog link={resetLink} onClose={() => setResetLink(null)} />
      <RenewExpiryDialog user={renewTarget} onConfirm={confirmRenew} onCancel={() => setRenewTarget(null)} />
      <ChangeExpiryDialog user={expiryTarget} onConfirm={confirmExpiry} onCancel={() => setExpiryTarget(null)} />
    </section>
  );
}

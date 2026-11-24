import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/modules/core/ui/button";
import { buttonVariants } from "@/modules/core/ui/button-variants";
import { Input } from "@/modules/core/ui/input";
import { FieldHint } from "@/modules/core/components/form/FieldHint";
import { DialogClose, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/modules/core/ui/dialog";
import type { UserSummaryResponse } from "@/modules/core/services/generated/model";
import { expirySchema, type ExpiryValues } from "../schemas/expiry";
import type { ChangeExpiryDialogProps } from "./ChangeExpiryDialog";

/** Contenido del diálogo de fecha: el último día con acceso completo; una fecha pasada deja la cuenta en solo lectura. */
export function ChangeExpiryForm({
  user,
  onConfirm,
}: {
  user: UserSummaryResponse;
  onConfirm: ChangeExpiryDialogProps["onConfirm"];
}) {
  const form = useForm<ExpiryValues>({
    resolver: zodResolver(expirySchema),
    mode: "onTouched",
    defaultValues: { expiresOn: user.expiresOn ?? "" },
  });
  const { errors } = form.formState;

  return (
    <form onSubmit={form.handleSubmit((values) => onConfirm(user, values.expiresOn))} noValidate className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Cambiar la fecha de {user.fullName}</DialogTitle>
        <DialogDescription>
          Es el último día con acceso completo: ese día todavía puede editar. Una fecha pasada deja la cuenta en solo lectura.
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-2">
        <label htmlFor="expiry-date" className="text-sm font-medium">
          Último día de acceso
        </label>
        <Input id="expiry-date" type="date" className="max-w-48" aria-invalid={Boolean(errors.expiresOn)} {...form.register("expiresOn")} />
        {errors.expiresOn ? (
          <p className="text-sm text-destructive" role="alert">
            {errors.expiresOn.message}
          </p>
        ) : (
          <FieldHint>Fecha de Lima.</FieldHint>
        )}
      </div>
      <DialogFooter>
        <DialogClose className={buttonVariants({ variant: "outline" })}>Cancelar</DialogClose>
        <Button type="submit">Guardar</Button>
      </DialogFooter>
    </form>
  );
}

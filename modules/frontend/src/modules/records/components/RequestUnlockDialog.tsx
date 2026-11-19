import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/modules/core/ui/button";
import { buttonVariants } from "@/modules/core/ui/button-variants";
import { ChoiceField } from "@/modules/core/components/form/ChoiceField";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/core/ui/dialog";
import type { UnlockRequestRequestReason } from "@/modules/core/services/generated/model";
import { unlockReasonOptions } from "../config/options";
import { unlockRequestSchema, type UnlockRequestValues } from "../schemas/unlockRequest";

interface RequestUnlockDialogProps {
  open: boolean;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (reason: UnlockRequestRequestReason) => void;
}

/** El tratante pide al ADMIN desbloquear los datos del paciente, eligiendo el motivo de un catálogo cerrado. */
export function RequestUnlockDialog({ open, pending, onOpenChange, onSubmit }: RequestUnlockDialogProps) {
  const form = useForm<UnlockRequestValues>({
    resolver: zodResolver(unlockRequestSchema),
    mode: "onTouched",
    defaultValues: {},
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <FormProvider {...form}>
          <form noValidate onSubmit={form.handleSubmit((values) => onSubmit(values.reason))} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Solicitar desbloqueo</DialogTitle>
              <DialogDescription>
                El administrador revisará la solicitud. Elige qué dato hay que corregir; los detalles se hablan fuera del sistema.
              </DialogDescription>
            </DialogHeader>
            <ChoiceField<UnlockRequestValues> name="reason" label="¿Qué dato hay que corregir?" options={unlockReasonOptions} vertical />
            <DialogFooter>
              <DialogClose className={buttonVariants({ variant: "outline" })}>Cancelar</DialogClose>
              <Button type="submit" disabled={pending}>
                Enviar solicitud
              </Button>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}

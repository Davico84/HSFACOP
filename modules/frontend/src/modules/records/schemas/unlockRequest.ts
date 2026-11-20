import { z } from "zod";
import { UnlockRequestRequestReason } from "@/modules/core/services/generated/model";

/** Motivo de la solicitud de desbloqueo: un código del catálogo cerrado (el servidor rechaza cualquier texto libre). */
export const unlockRequestSchema = z.object({
  reason: z.enum(Object.values(UnlockRequestRequestReason) as [UnlockRequestRequestReason, ...UnlockRequestRequestReason[]], {
    message: "Elige el motivo.",
  }),
});

export type UnlockRequestValues = z.infer<typeof unlockRequestSchema>;

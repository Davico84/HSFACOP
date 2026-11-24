import { z } from "zod";

/**
 * Fecha de vencimiento fijada a mano (fecha civil de Lima, último día con acceso completo). El
 * servidor solo exige una fecha válida: una pasada deja la cuenta en solo lectura y se permite.
 */
export const expirySchema = z.object({
  expiresOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Elige una fecha.")
    .refine((value) => {
      const date = new Date(`${value}T00:00:00Z`);
      return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
    }, "La fecha no es válida."),
});

export type ExpiryValues = z.infer<typeof expirySchema>;

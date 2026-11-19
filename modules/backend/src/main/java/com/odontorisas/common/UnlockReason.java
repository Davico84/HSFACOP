package com.odontorisas.common;

/**
 * Motivo del desbloqueo de los datos fijos del paciente: catálogo cerrado, sin texto libre (que
 * podía contener un nombre o un documento).
 */
public enum UnlockReason {
    /** El alias está mal escrito. */
    ALIAS,
    /** El sexo está mal registrado. */
    SEXO,
    /** La edad está mal registrada. */
    EDAD,
    /** Otro motivo; se aclara fuera del sistema. */
    OTRO;

    /**
     * Interpreta el motivo guardado: un código del catálogo, o {@code OTRO} si es un texto libre de
     * antes del cambio (la migración los reemplaza, pero hasta entonces no deben romper la lectura).
     */
    public static UnlockReason fromStored(String stored) {
        if (stored == null) {
            return null;
        }
        for (UnlockReason reason : values()) {
            if (reason.name().equals(stored)) {
                return reason;
            }
        }
        return OTRO;
    }
}

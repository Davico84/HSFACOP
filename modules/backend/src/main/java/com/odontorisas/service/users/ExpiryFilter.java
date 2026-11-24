package com.odontorisas.service.users;

/** Filtro del listado de cuentas por vencimiento (solo cuentas activas USER o COORDINATOR). */
public enum ExpiryFilter {
    /** Vencen dentro de {@link AccountExpiry#SOON_DAYS} días (incluido hoy). */
    SOON,
    /** Ya vencieron. */
    EXPIRED
}

package com.odontorisas.service.users;

import com.odontorisas.common.Role;
import com.odontorisas.persistence.entity.User;

import java.time.Clock;
import java.time.LocalDate;

/**
 * Reglas del vencimiento de cuentas (capacidad {@code users}). {@code expiresOn} es el último día
 * (fecha civil de Lima, la zona del {@link Clock}) con acceso completo: la cuenta está vencida si
 * hoy es posterior. El ADMIN no vence. Todo se evalúa contra la base, nunca contra el token.
 */
public final class AccountExpiry {

    /** Meses que dura el acceso desde el alta o desde una renovación. */
    public static final int MONTHS = 12;

    /** Ventana de "por vencer" que ve el ADMIN en Inicio y en Usuarios. */
    public static final int SOON_DAYS = 30;

    private AccountExpiry() {
    }

    public static LocalDate today(Clock clock) {
        return LocalDate.now(clock);
    }

    /** Último día de acceso de una cuenta nueva (o con vencimiento ausente al crearse). */
    public static LocalDate initial(Clock clock) {
        return today(clock).plusMonths(MONTHS);
    }

    public static boolean isExpired(User user, LocalDate today) {
        return user.getRole() != Role.ADMIN && user.getExpiresOn() != null && today.isAfter(user.getExpiresOn());
    }

    /** Renovación: 12 meses desde el mayor entre hoy y el vencimiento actual (no pierde los días que quedaban). */
    public static LocalDate renewed(User user, LocalDate today) {
        LocalDate base = user.getExpiresOn() != null && user.getExpiresOn().isAfter(today) ? user.getExpiresOn() : today;
        return base.plusMonths(MONTHS);
    }

    /** Lanza {@link AccountExpiredException} si la cuenta (releída de la base) está vencida. */
    public static void requireWritable(User user, Clock clock) {
        if (isExpired(user, today(clock))) {
            throw new AccountExpiredException();
        }
    }
}

package com.odontorisas.infra.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Instant;

/**
 * Ventana en que el autor de una historia puede copiar a su libreta local los datos antiguos del
 * paciente (prefijo {@code app.legacy-copy}).
 *
 * @param deadline fecha límite de copia (instante ISO-8601, p. ej. {@code 2026-12-04T05:00:00Z}), una
 *                 única configuración fija que se escribe al desplegar la libreta. Vacía = la ventana
 *                 está cerrada: la operación responde {@code 404} y el script de migración no corre.
 */
@ConfigurationProperties(prefix = "app.legacy-copy")
public record LegacyCopyProperties(Instant deadline) {

    /** ¿La ventana sigue abierta en este instante? Sin fecha configurada, nunca. */
    public boolean isOpenAt(Instant now) {
        return deadline != null && now.isBefore(deadline);
    }
}

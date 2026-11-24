package com.odontorisas.presentation.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

/** Último día con acceso completo de una cuenta USER o COORDINATOR (fecha civil de Lima). */
public record ChangeUserExpiryRequest(
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED, example = "2027-12-31",
        description = "Último día con acceso completo; una fecha pasada deja la cuenta en solo lectura")
    @NotNull LocalDate expiresOn) {
}

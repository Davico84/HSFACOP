package com.odontorisas.presentation.dto;

import com.odontorisas.common.UnlockReason;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

/** Solicitud de desbloqueo de los datos del paciente: el motivo es un código del catálogo cerrado, sin texto libre. */
public record UnlockRequestRequest(
    @Schema(requiredMode = REQUIRED, example = "ALIAS", description = "Motivo del catálogo: ALIAS, SEXO, EDAD u OTRO")
    @NotNull(message = "Indica el motivo.")
    UnlockReason reason) {
}

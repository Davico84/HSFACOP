package com.odontorisas.presentation.dto;

import com.odontorisas.common.Role;
import com.odontorisas.service.auth.UserView;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDate;

/** Datos públicos del usuario autenticado. */
public record UserResponse(
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Long id,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String email,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Role role,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String fullName,
    @Schema(description = "Último día con acceso completo (fecha de Lima); nulo en cuentas ADMIN, que no vencen", nullable = true)
    LocalDate expiresOn,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "La cuenta venció: puede ver e imprimir, no crear ni guardar")
    boolean readOnly) {

    public static UserResponse from(UserView user) {
        return new UserResponse(user.id(), user.email(), user.role(), user.fullName(), user.expiresOn(), user.readOnly());
    }
}

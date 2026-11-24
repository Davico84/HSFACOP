package com.odontorisas.service.auth;

import com.odontorisas.common.Role;

import java.time.LocalDate;

/**
 * Vista de usuario que sale del servicio hacia la presentación (sin datos sensibles). {@code expiresOn}
 * es el último día con acceso completo (nulo en el ADMIN) y {@code readOnly} dice si la cuenta ya venció.
 */
public record UserView(Long id, String email, Role role, String fullName, LocalDate expiresOn, boolean readOnly) {}

package com.odontorisas.service.users;

import com.odontorisas.service.BusinessException;
import org.springframework.http.HttpStatus;

/**
 * La cuenta venció y está en solo lectura (403): puede ver e imprimir, no crear ni guardar. El
 * cliente reconoce el código {@code account-expired} para volver a consultar la sesión.
 */
public class AccountExpiredException extends BusinessException {
    public AccountExpiredException() {
        super("Tu acceso venció. Puedes ver e imprimir tus historias; para seguir editando, pide la renovación al administrador.",
            HttpStatus.FORBIDDEN, "account-expired");
    }
}

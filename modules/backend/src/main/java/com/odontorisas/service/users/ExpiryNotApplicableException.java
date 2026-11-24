package com.odontorisas.service.users;

import com.odontorisas.service.BusinessException;
import org.springframework.http.HttpStatus;

/** El vencimiento aplica a cuentas USER y COORDINATOR; una cuenta ADMIN no vence (409). */
public class ExpiryNotApplicableException extends BusinessException {
    public ExpiryNotApplicableException() {
        super("Una cuenta ADMIN no vence.", HttpStatus.CONFLICT, "expiry-not-applicable");
    }
}

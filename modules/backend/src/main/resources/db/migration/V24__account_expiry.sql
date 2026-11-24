-- Capacidad users — add-account-expiry.
-- Último día con acceso completo de una cuenta USER o COORDINATOR (fecha civil de Lima). Pasado ese
-- día la cuenta queda en solo lectura. La cuenta ADMIN no vence (nula). Las cuentas existentes
-- reciben su fecha de alta (en Lima) más 12 meses.
ALTER TABLE users ADD COLUMN expires_on DATE;

UPDATE users
SET expires_on = ((created_at AT TIME ZONE 'America/Lima')::date + INTERVAL '12 months')::date
WHERE role <> 'ADMIN';

-- Tras el relleno: solo el ADMIN puede quedar sin vencimiento.
ALTER TABLE users ADD CONSTRAINT ck_users_expires_on CHECK (role = 'ADMIN' OR expires_on IS NOT NULL);

## Context

- `users` tiene `status` (`ACTIVE`/`DISABLED`, V7) independiente de `locked_until`. `DISABLED` rechaza el login y revoca sesiones; no sirve para "solo lectura".
- Las escrituras de historias pasan por `OrthodonticRecordService` (`create`, `update`, `print`, `requestUnlock`, …). Ya existe `RecordWriteForbiddenException` (403 `access-denied`) para una coordinación con token viejo de alumno: el servicio relee el rol **de la base**, no del token. El mismo patrón sirve para el vencimiento: la base manda, no el JWT.
- La sesión que ve el frontend es `UserResponse` (`id`, `email`, `role`, `fullName`). La zona horaria de la app es `America/Lima`; el servicio usa un `Clock` inyectable.
- `PrintView`: la primera impresión fija los datos del paciente (`patientLockedAt`). La libreta local vive en IndexedDB y no toca el servidor.
- Migraciones: la última es V23. El retiro de columnas del alias (V24 en sus tareas) aún no existe.

## Goals / Non-Goals

**Goals:**
- Vencimiento por cuenta, evaluado en el servidor contra la base, que deja la cuenta en solo lectura sin perder datos.
- Una sola guarda de escritura, reutilizable, para que ningún endpoint nuevo olvide el vencimiento.
- Que el `ADMIN` renueve sin fricción y vea quién vence pronto.

**Non-Goals:** ver `proposal.md` (sin pre-aviso al tratante, sin pagos, sin borrado automático).

## Decisions

**1. Columna `users.expires_at` (`timestamptz`, nula para `ADMIN`).** Se guarda la fecha, no un booleano ni un cálculo desde `created_at`: el `ADMIN` puede renovar, fijarla a mano o dar más margen a una cuenta concreta. Alternativa descartada: derivar siempre `created_at + 12 meses` (no permite renovar). `expires_at` se evalúa como vencida cuando `expires_at <= ahora` (instante del `Clock`). Se muestra y se fija en fecha civil de Lima; internamente es el inicio del día siguiente a la fecha elegida, para que "vence el 30" signifique que el 30 todavía puede editar.

**2. Migración y relleno.** Columna nullable + `UPDATE users SET expires_at = created_at + INTERVAL '12 months' WHERE role IN ('USER','COORDINATOR')`; `ADMIN` queda nulo. Como la app tiene pocos meses, ninguna cuenta existente queda vencida al migrar (verificar con una consulta previa al aplicar y registrar el resultado). Restricción: `CHECK (role = 'ADMIN' OR expires_at IS NOT NULL)` se agrega **después** del relleno, en la misma migración.

**3. Numeración de migraciones.** Este change toma el siguiente número libre al aplicar (hoy V24). El retiro de columnas del alias —pendiente tras `LEGACY_COPY_DEADLINE`— pasa a numerarse después. Razón: Flyway rechaza una migración con versión menor que la última aplicada. Se anota en `tasks.md` y en `docs/vision.md`.

**4. Guarda central `AccountAccess.requireWritable(user)`** en `service/users`, que lanza `AccountExpiredException` (403, código `account-expired`, mensaje en español: "Tu acceso venció. Puedes ver e imprimir tus historias; para seguir editando, pide la renovación al administrador."). Se llama al inicio de `create`, `update` y `requestUnlock`, tras cargar al usuario de la base. `ADMIN` pasa siempre. Alternativa descartada: filtro HTTP por método (`POST/PUT/DELETE`): bloquearía también cambio de contraseña, "Mis datos" y `notebook-backup`, que sí deben seguir.

**5. Qué sigue permitido en solo lectura:** `GET` de historias y cupo, buscar (`POST /search`, es lectura), imprimir (`POST /{id}/print`), cambio de contraseña, "Mis datos", cierre de sesión, renovación de token y la confirmación de respaldo de la libreta (`notebook-backup`: solo marca que el tratante guardó su copia). Imprimir queda permitido porque el papel firmado es el registro oficial y el tratante debe poder emitirlo; su única escritura (fijar los datos del paciente en la primera impresión) no altera contenido clínico. Se acepta ese efecto.

**6. La sesión informa el estado.** `UserResponse` suma `expiresAt` (instante o nulo) y `readOnly` (booleano calculado en el servidor, para que el cliente no compare relojes). El JWT no lleva el vencimiento: si la cuenta se renueva, el cambio rige en la siguiente llamada a `/auth/me` o al renovar el token, sin forzar nuevo login. El frontend vuelve a pedir la sesión al recibir un `403 account-expired`, para pasar a solo lectura de inmediato.

**7. Renovación por el `ADMIN`.** `POST /api/users/{id}/expiry/renew`: nueva fecha = `max(ahora, expires_at) + 12 meses` (renovar antes de tiempo no pierde los días que quedaban). `PUT /api/users/{id}/expiry` con una fecha civil explícita (no puede ser anterior a hoy menos 0 días: fijar una fecha pasada vence la cuenta, y eso se permite solo si el `ADMIN` lo pide expresamente con una fecha, sin atajo). Ambos: solo `USER`/`COORDINATOR` (otro rol: `409`); un `ADMIN` ajeno al rol: `403`. Se registra en el log de aplicación solo `userId` y la acción, sin correo.

**8. Alerta del `ADMIN`.** `AdminDashboardResponse` suma `accounts.expiringSoon` (vencen en los próximos 30 días, sin vencer) y `accounts.expired`, calculados con una consulta agregada en `DashboardQueries` sobre `expires_at` y el `Clock`. "Usuarios" acepta un filtro `vencimiento=por-vencer|vencidas` para enlazar desde la tarjeta. Solo cuentas `ACTIVE`: una cuenta `DISABLED` no cuenta como por vencer.

**9. Frontend.** El store de sesión conserva `expiresAt`/`readOnly`. Un aviso persistente en el shell (solo si `readOnly`) explica la situación y a quién escribir; "Nueva historia", "Guardar", "Solicitar desbloqueo" se deshabilitan con la razón (mismo patrón que el cupo lleno). La pantalla de la historia abre en modo lectura. En Usuarios: columna "Vence" (fecha, y "Vencida" destacada con texto además de color) y acciones "Renovar" y "Cambiar fecha" con confirmación.

**10. Interacciones.** Cupo: una cuenta vencida no cuenta como cupo lleno; el motivo mostrado es el vencimiento (tiene prioridad). Libreta: sin cambios. Deshabilitar vs. vencer: `DISABLED` sigue cortando el login; una cuenta vencida y deshabilitada se trata como deshabilitada. Convertir `USER` ↔ `COORDINATOR` conserva `expires_at`. Un `USER` ascendido a `ADMIN` (si algún día se permite) pasa a `expires_at` nulo.

## Risks / Trade-offs

- **Relojes y zona horaria:** vencimiento a medianoche de Lima; se prueba con `Clock` fijo en el borde exacto.
- **Cuentas existentes con alta antigua:** hoy ninguna vence al migrar; si el relleno dejara alguna vencida, el `ADMIN` la renueva desde Usuarios y la consulta previa lo avisa antes de desplegar.
- **Una escritura olvidada:** la guarda central + un test de arquitectura/IT que recorre los endpoints de escritura de historias reduce el riesgo; los endpoints nuevos deben llamar a la guarda.
- **Imprimir fija datos aun vencida:** efecto menor, aceptado y documentado.
- **Sin pre-aviso al tratante:** puede enterarse del vencimiento en pleno uso; es decisión de producto (no hay correo hoy). La alerta del `ADMIN` es el mecanismo de prevención.

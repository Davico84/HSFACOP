## Why

Las cuentas de alumno y de coordinación hoy no vencen: una vez creadas, siguen activas hasta que el `ADMIN` las deshabilita a mano. El acceso se concede por un periodo de 12 meses, y lo único que existe para cerrarlo es el estado `DISABLED`, que corta todo (incluso ver o imprimir lo ya escrito) y exige que el `ADMIN` se acuerde de hacerlo cuenta por cuenta.

Hace falta un vencimiento por cuenta que no destruya el trabajo del tratante: al vencer, la cuenta pasa a solo lectura (sigue viendo e imprimiendo sus historias) y el `ADMIN` ve de un vistazo quién vence pronto y quién ya venció, para renovar a tiempo.

## What Changes

- **Fecha de vencimiento por cuenta:** cada cuenta `USER` y `COORDINATOR` guarda cuándo vence. Se calcula al registrarse (alta + 12 meses). Las cuentas existentes reciben alta + 12 meses al migrar. El `ADMIN` no vence.
- **Solo lectura al vencer:** una cuenta vencida sigue iniciando sesión, viendo e imprimiendo sus historias; no puede crear historias, guardar cambios, solicitar desbloqueos ni cambiar el estado clínico. Esas escrituras responden `403` con un código propio (`account-expired`). Cambiar la contraseña, editar "Mis datos" y cerrar sesión siguen permitidos.
- **Renovar desde Usuarios:** el `ADMIN` renueva una cuenta (+12 meses contados desde hoy, o desde la fecha actual de vencimiento si aún no ha vencido) o fija la fecha a mano. La renovación es inmediata: no exige volver a iniciar sesión.
- **Alerta al `ADMIN`:** Inicio del `ADMIN` muestra cuántas cuentas vencen en los próximos 30 días y cuántas ya vencieron, con acceso a "Usuarios" filtrado.
- **Aviso al tratante ya vencido:** la app muestra un aviso persistente ("Tu acceso venció el … Puedes ver e imprimir tus historias; para seguir editando, pide la renovación al administrador"), deshabilita los controles de escritura y no ofrece "Nueva historia". Sin aviso previo al vencimiento.
- **Sin cambios:** la libreta local (es del navegador, sigue funcionando), la impresión de historias (permitida; la primera impresión sigue fijando los datos del paciente), el cupo de historias, el estado `ACTIVE`/`DISABLED` y el bloqueo temporal por intentos fallidos.
- **Contrato:** `UserResponse` (sesión) suma `expiresOn` y `readOnly`; `UserSummaryResponse` suma `expiresOn` y `expired`; el Inicio del `ADMIN` suma los conteos. Nuevos endpoints de renovación y de fecha. El cliente se regenera.

## Capabilities

### New Capabilities
- Ninguna.

### Modified Capabilities
- `users`: vencimiento por cuenta, columna y acciones "Renovar" / fijar fecha en Usuarios (solo `ADMIN`), y la regla de que `ADMIN` no vence.
- `authentication`: el registro fija el vencimiento; la sesión informa `expiresOn` y `readOnly`; una cuenta vencida sigue iniciando sesión y renovando token.
- `orthodontic-records`: una cuenta vencida solo lee e imprime; crear, guardar y solicitar desbloqueo responden `403 account-expired`.
- `dashboard`: Inicio del `ADMIN` muestra cuentas por vencer en 30 días y vencidas.

## Impact

- **Backend:** migración Flyway (columna `users.expires_on`, relleno de las cuentas existentes); `User`; `AuthService` (registro) y la construcción de la sesión; `UserAdminService` + `UsersController` (renovar, fijar fecha, listar con `expiresAt` y filtro); `OrthodonticRecordService` (guarda de escritura central); `GlobalExceptionHandler`/excepción nueva; `DashboardQueries`/`AdminDashboardResponse`; pruebas de integración; `contracts/openapi.json` (guarda de deriva).
- **Frontend:** estado de sesión (`expiresOn`, `readOnly`), aviso de cuenta vencida en el shell, controles de escritura deshabilitados (Nueva historia, guardar, solicitar desbloqueo), columna y acciones en Usuarios, tarjeta en Inicio del `ADMIN`; cliente regenerado con `pnpm generate:api`; pruebas Vitest/MSW.
- **Docs:** `docs/domain.md` (campo y regla), `docs/vision.md` (estado del cambio y, al archivar, capacidad construida).
- **Relación con otros changes:** el retiro de las columnas del alias (migración pendiente, tareas 3.3–3.5 del change archivado del alias) debe numerarse **después** de la migración de este change, porque Flyway no aplica migraciones anteriores a la última ya aplicada. Ver `design.md`.

## Non-goals

- Correo o notificación de pre-aviso al tratante (no hay SMTP en uso; el aviso solo aparece cuando ya venció).
- Vencimiento del `ADMIN`.
- Pagos, facturación o precios: el vencimiento es una fecha que el `ADMIN` fija o renueva a mano.
- Vencimiento por turma o por institución (el plazo es por cuenta).
- Borrado o archivado automático de historias de cuentas vencidas: los datos se conservan.
- Cambiar la política de la libreta local o del cupo.
- Renovación automática o autoservicio del tratante.

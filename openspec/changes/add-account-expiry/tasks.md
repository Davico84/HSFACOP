# Tasks

## 1. Backend — modelo y migración

- [x] 1.1 Migración Flyway con el siguiente número libre (hoy V24): `users.expires_at timestamptz`, relleno `created_at + 12 meses` para `USER`/`COORDINATOR`, `CHECK (role = 'ADMIN' OR expires_at IS NOT NULL)` tras el relleno; consulta previa que informa cuántas cuentas quedarían vencidas
- [x] 1.2 `User.expiresAt` y regla "vencida" con `Clock` (borde exacto a medianoche de Lima)
- [x] 1.3 `AuthService`: el registro fija alta + 12 meses e ignora cualquier vencimiento del cliente; convertir de rol conserva la fecha

## 2. Backend — guarda, sesión y renovación

- [x] 2.1 `AccountAccess.requireWritable` + `AccountExpiredException` (403, `account-expired`); llamarla en `create`, `update` y `requestUnlock` leyendo la base
- [x] 2.2 `UserResponse` suma `expiresAt` y `readOnly` en login, refresh y consulta de sesión
- [x] 2.3 `POST /api/users/{id}/expiry/renew` y `PUT /api/users/{id}/expiry` (solo `ADMIN`; `409` sobre `ADMIN`)
- [x] 2.4 `UserSummaryResponse.expiresAt` y filtro `vencimiento` en el listado (solo cuentas activas)
- [x] 2.5 `AdminDashboardResponse.accounts.expiringSoon` y `.expired` en `DashboardQueries`
- [x] 2.6 Regenerar `contracts/openapi.json` (`-Dcontract.update=true`)

## 3. Backend — tests (derivados de los Scenario)

- [x] 3.1 IT de vencimiento: migración, registro, conversión de rol, renovación (vencida y anticipada), fecha a mano, `409`/`403`
- [x] 3.2 IT de solo lectura: leer, buscar, imprimir y cambiar contraseña funcionan; crear, guardar y solicitar desbloqueo dan `403 account-expired`; token anterior a la renovación; `ADMIN` nunca
- [x] 3.3 IT de Inicio del `ADMIN` (por vencer, vencidas, deshabilitadas excluidas) y del filtro de Usuarios
- [x] 3.4 `mvn verify` en verde

## 4. Frontend

- [x] 4.1 `pnpm generate:api`; sesión con `expiresAt`/`readOnly`; al recibir `403 account-expired` volver a consultar la sesión
- [x] 4.2 Aviso persistente en el shell, "Nueva historia" oculto, guardar y solicitar desbloqueo deshabilitados con motivo; historia en modo lectura; imprimir activo (aplicar `frontend-guard`)
- [x] 4.3 Usuarios: columna "Vence"/"Vencida", acciones "Renovar" y "Cambiar fecha" con confirmación, filtro por vencimiento
- [x] 4.4 Inicio del `ADMIN`: cuentas por vencer y vencidas con enlace filtrado
- [ ] 4.5 Tests Vitest/MSW por Scenario y e2e Playwright del flujo vencida → renovar; `pnpm validate` en verde

## 5. Docs y cierre

- [x] 5.1 `docs/domain.md` (campo `expires_at` y regla de solo lectura) y `docs/vision.md` (estado del cambio; al archivar, capacidad construida con enlace a los specs)
- [x] 5.2 Anotar que el retiro de columnas del alias se numera después de esta migración
- [x] 5.3 `openspec validate add-account-expiry --strict`

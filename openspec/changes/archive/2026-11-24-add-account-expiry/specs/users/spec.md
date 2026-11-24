## ADDED Requirements

### Requirement: Vencimiento de la cuenta
Cada cuenta `USER` o `COORDINATOR` SHALL tener una fecha de vencimiento; una cuenta `ADMIN` NO SHALL vencer. La fecha es el último día con acceso completo (fecha civil de Lima); la cuenta está vencida cuando hoy es posterior a ella. Al migrar, las cuentas existentes SHALL recibir su fecha de alta más 12 meses. Convertir una cuenta entre `USER` y `COORDINATOR` SHALL conservar la fecha.

#### Scenario: Cuenta existente al migrar
- **WHEN** se aplica la migración y una cuenta `USER` se creó el 2026-10-06
- **THEN** su último día de acceso es el 2027-10-06 y la cuenta `ADMIN` queda sin vencimiento

#### Scenario: Cambio de rol conserva el vencimiento
- **WHEN** un `ADMIN` convierte una cuenta `USER` en `COORDINATOR`
- **THEN** su fecha de vencimiento no cambia

#### Scenario: El ADMIN no vence
- **WHEN** se consulta la cuenta de un `ADMIN`
- **THEN** no tiene fecha de vencimiento y nunca está en solo lectura

### Requirement: Renovar o fijar el vencimiento
Un `ADMIN` SHALL poder renovar una cuenta `USER` o `COORDINATOR`: la nueva fecha es la mayor entre hoy y el vencimiento actual, más 12 meses. Un `ADMIN` SHALL poder fijar la fecha a mano con una fecha civil de Lima, que vence al terminar ese día. Sobre una cuenta `ADMIN` SHALL responder `409`; para otro rol, `403`. El cambio SHALL regir de inmediato, sin nuevo inicio de sesión.

#### Scenario: Renovar una cuenta vencida
- **WHEN** un `ADMIN` renueva el 2027-11-01 una cuenta que venció el 2027-10-06
- **THEN** la cuenta vence el 2028-11-01 y deja de estar en solo lectura

#### Scenario: Renovar antes de tiempo no pierde días
- **WHEN** un `ADMIN` renueva una cuenta que vence en 20 días
- **THEN** la nueva fecha es el vencimiento anterior más 12 meses

#### Scenario: Fijar la fecha a mano
- **WHEN** un `ADMIN` fija el 2027-12-31
- **THEN** la cuenta puede editar durante ese día y queda en solo lectura desde el siguiente

#### Scenario: Cuenta ADMIN
- **WHEN** un `ADMIN` intenta renovar la cuenta de otro `ADMIN`
- **THEN** la API responde `409`

#### Scenario: Sin permiso
- **WHEN** un `USER` o un `COORDINATOR` intenta renovar o fijar un vencimiento
- **THEN** la API responde `403`

### Requirement: Vencimiento en Usuarios
En "Usuarios", cada cuenta `USER` o `COORDINATOR` SHALL mostrar su vencimiento ("Vence el …" o "Vencida" con texto, no solo color) y ofrecer "Renovar" y "Cambiar fecha" tras una confirmación. El listado SHALL poder filtrarse por cuentas por vencer en 30 días y por cuentas vencidas, solo entre cuentas activas.

#### Scenario: Cuenta vencida en el listado
- **WHEN** el `ADMIN` abre "Usuarios" y una cuenta venció
- **THEN** su fila dice "Vencida" y ofrece "Renovar"

#### Scenario: Renovar desde la fila
- **WHEN** el `ADMIN` confirma "Renovar"
- **THEN** la fila muestra la nueva fecha sin recargar la página

#### Scenario: Filtro de cuentas por vencer
- **WHEN** el `ADMIN` filtra por "por vencer" y una cuenta activa vence en 10 días, otra en 90 y otra deshabilitada en 10
- **THEN** el listado muestra solo la primera

## ADDED Requirements

### Requirement: Vencimiento inicial en el registro
Al registrarse, una cuenta nueva SHALL recibir como vencimiento la fecha de alta más 12 meses. El registro NO SHALL aceptar un vencimiento enviado por el cliente.

#### Scenario: Registro fija el vencimiento
- **WHEN** una persona se registra el 2026-11-24
- **THEN** su cuenta vence el 2027-11-24

#### Scenario: Vencimiento enviado por el cliente
- **WHEN** la solicitud de registro incluye un campo de vencimiento
- **THEN** se ignora y rige alta más 12 meses

### Requirement: La sesión informa el vencimiento
La respuesta de sesión (inicio de sesión, renovación de token y consulta de la sesión) SHALL incluir `expiresOn` (último día con acceso completo, fecha de Lima) y `readOnly`, calculado en el servidor contra la base. Una cuenta vencida SHALL poder iniciar sesión y renovar su token; el token NO SHALL llevar el vencimiento, de modo que una renovación rija sin nuevo inicio de sesión.

#### Scenario: Cuenta vencida inicia sesión
- **WHEN** una cuenta `USER` vencida inicia sesión con credenciales correctas
- **THEN** la sesión se abre con `readOnly` verdadero

#### Scenario: Renovación rige sin nuevo login
- **WHEN** un `ADMIN` renueva una cuenta vencida y su titular consulta la sesión con el mismo token
- **THEN** `readOnly` es falso

#### Scenario: ADMIN
- **WHEN** un `ADMIN` inicia sesión
- **THEN** `expiresOn` es nulo y `readOnly` falso

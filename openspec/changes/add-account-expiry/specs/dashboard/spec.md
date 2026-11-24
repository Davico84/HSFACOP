## ADDED Requirements

### Requirement: Cuentas por vencer y vencidas en Inicio del ADMIN
Inicio del `ADMIN` SHALL mostrar cuántas cuentas activas `USER` o `COORDINATOR` vencen en los próximos 30 días y cuántas ya vencieron, calculadas en el servidor con consultas agregadas, con enlace a "Usuarios" ya filtrado. Las cuentas deshabilitadas NO SHALL contarse.

#### Scenario: Conteos
- **WHEN** hay una cuenta activa que vence en 10 días, una vencida y una deshabilitada que vence en 10 días
- **THEN** Inicio muestra 1 por vencer y 1 vencida

#### Scenario: Enlace filtrado
- **WHEN** el `ADMIN` abre el enlace de las vencidas
- **THEN** "Usuarios" abre filtrado por cuentas vencidas

#### Scenario: Nada por vencer
- **WHEN** ninguna cuenta vence pronto ni está vencida
- **THEN** Inicio indica que no hay cuentas por renovar

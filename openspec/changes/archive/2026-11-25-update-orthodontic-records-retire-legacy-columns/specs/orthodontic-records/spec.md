## ADDED Requirements

### Requirement: Esquema sin identificadores del paciente
El esquema de `orthodontic_records` SHALL NOT contener columnas con la identidad antigua del paciente (documento, nacimiento, lugar, domicilio, celular, nombre completo y nombres de firma anteriores). La migración que las retira SHALL comprobar antes que ninguna fila conserva valores en ellas y, si alguna los conserva, SHALL abortar sin cambiar el esquema y con un error que no incluye ningún valor.

#### Scenario: Retiro del esquema
- **WHEN** no queda ninguna historia con datos en las columnas retiradas y se aplica la migración
- **THEN** esas columnas dejan de existir y el esquema resultante no contiene identificadores del paciente

#### Scenario: Retiro con historias pendientes
- **WHEN** queda al menos una historia con datos en esas columnas
- **THEN** la migración aborta con un error que no incluye ningún valor y no cambia el esquema

#### Scenario: Datos antiguos ya no disponibles
- **WHEN** un autor pide los datos antiguos de su historia con `GET /orthodontic-records/{id}/legacy-identity`
- **THEN** la API responde `404` y la historia se sigue abriendo, guardando e imprimiendo con alias, sexo y edad

## MODIFIED Requirements

### Requirement: Cuenta vencida solo lee e imprime
Una cuenta vencida SHALL poder listar, buscar, abrir e imprimir sus historias. Crear una historia, guardar cambios y solicitar un desbloqueo SHALL responder `403` con el código `account-expired`, evaluado contra la base y no contra el token. Cambiar la contraseña y editar "Mis datos" NO SHALL bloquearse. El cupo NO SHALL ser el motivo mostrado cuando la cuenta está vencida.

#### Scenario: Leer e imprimir
- **WHEN** una cuenta vencida abre una historia y la imprime
- **THEN** ambas acciones funcionan y la primera impresión fija los datos del paciente como siempre

#### Scenario: Crear una historia
- **WHEN** una cuenta vencida con cupo libre crea una historia
- **THEN** la API responde `403` con `account-expired` y no se crea nada

#### Scenario: Guardar cambios
- **WHEN** una cuenta vencida guarda cambios en una historia
- **THEN** la API responde `403` con `account-expired` y la historia no cambia

#### Scenario: Solicitar desbloqueo
- **WHEN** una cuenta vencida solicita desbloquear los datos del paciente
- **THEN** la API responde `403` con `account-expired`

#### Scenario: Token anterior a la renovación
- **WHEN** una cuenta renovada guarda cambios con un token emitido antes de renovar
- **THEN** el guardado funciona

#### Scenario: Libreta y datos propios
- **WHEN** una cuenta vencida cambia su contraseña o edita "Mis datos"
- **THEN** ambas acciones funcionan

## REMOVED Requirements

### Requirement: Migración de las historias existentes al alias
**Reason**: La acción administrativa única se ejecutó el 2026-11-25 (11 historias migradas, verificación final en cero) y el código que la ejecutaba se retira junto con las columnas que leía. El requisito describía una operación puntual, no un comportamiento permanente del sistema.
**Migration**: Ninguna. Los escenarios "Retiro del esquema" y "Retiro con historias pendientes" pasan al requisito "Esquema sin identificadores del paciente"; la validación de la menarquia frente a la edad se mantiene en su propio requisito. La acción y su historial quedan en el change archivado `update-orthodontic-records-pseudonymous-patient`.

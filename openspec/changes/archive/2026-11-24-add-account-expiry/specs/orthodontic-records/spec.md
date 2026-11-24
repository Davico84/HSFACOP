## ADDED Requirements

### Requirement: Cuenta vencida solo lee e imprime
Una cuenta vencida SHALL poder listar, buscar, abrir e imprimir sus historias. Crear una historia, guardar cambios y solicitar un desbloqueo SHALL responder `403` con el código `account-expired`, evaluado contra la base y no contra el token. Cambiar la contraseña, editar "Mis datos" y confirmar el respaldo de la libreta NO SHALL bloquearse. El cupo NO SHALL ser el motivo mostrado cuando la cuenta está vencida.

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
- **WHEN** una cuenta vencida cambia su contraseña o confirma el respaldo de su libreta
- **THEN** ambas acciones funcionan

### Requirement: Aviso y controles en modo solo lectura
Con la cuenta vencida, la aplicación SHALL mostrar un aviso persistente con la fecha de vencimiento, que explica que puede ver e imprimir y que para editar debe pedir la renovación al administrador; SHALL ocultar "Nueva historia" y deshabilitar guardar y solicitar desbloqueo con ese motivo. NO SHALL mostrar aviso antes del vencimiento.

#### Scenario: Aviso y controles
- **WHEN** una cuenta vencida abre una historia
- **THEN** ve el aviso con la fecha, la historia en modo lectura y el botón de imprimir activo

#### Scenario: Sin aviso previo
- **WHEN** una cuenta que vence en 5 días abre la aplicación
- **THEN** no aparece ningún aviso de vencimiento

#### Scenario: Pasa a solo lectura sin recargar
- **WHEN** la cuenta vence mientras el tratante guarda y la API responde `403` con `account-expired`
- **THEN** la aplicación vuelve a consultar la sesión y muestra el modo solo lectura

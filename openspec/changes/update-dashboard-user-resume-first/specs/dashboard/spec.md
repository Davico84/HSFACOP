# Spec Delta

## MODIFIED Requirements

### Requirement: Métricas del tratante en Inicio
Para un `USER`, Inicio SHALL mostrar el uso de su cupo ("N de M" o "sin límite") y un botón "Nueva historia" junto al saludo, calculados en el servidor sobre sus propias historias (`GET /api/dashboard/me`, solo para `USER`; un `ADMIN` recibe `403`). La respuesta SHALL incluir además el total de historias y las creadas en el mes en curso (según la zona horaria de la app), que Inicio usa para decidir si el tratante ya tiene historias. Las métricas NO SHALL incluir historias de otros tratantes. Con el cupo lleno, "Nueva historia" SHALL quedar deshabilitado y SHALL decir por qué, con el mismo aviso que la lista de historias.

#### Scenario: Historias y cupo
- **WHEN** un tratante con cupo 5 tiene 3 historias, una creada este mes
- **THEN** Inicio muestra "3 de 5" de cupo y el botón "Nueva historia" junto al saludo, y la API devuelve 3 historias y 1 creada este mes

#### Scenario: Sin límite de cupo
- **WHEN** un tratante sin cupo abre Inicio
- **THEN** el uso del cupo dice "sin límite"

#### Scenario: Cupo lleno
- **WHEN** un tratante con cupo 5 tiene 5 historias
- **THEN** "Nueva historia" aparece deshabilitado y el aviso del cupo lleno explica que no puede crear más

#### Scenario: ADMIN pide las métricas de tratante
- **WHEN** un `ADMIN` llama a `GET /api/dashboard/me`
- **THEN** la API responde `403`

#### Scenario: Solo sus historias
- **WHEN** otro tratante tiene 10 historias
- **THEN** no cuentan en las métricas de este tratante

#### Scenario: Sin historias todavía
- **WHEN** un tratante sin historias abre Inicio
- **THEN** ve una invitación a crear su primera historia, sin indicadores ni lista

### Requirement: Datos faltantes en las historias del tratante
Inicio SHALL indicar al `USER`, en cada historia de "Para retomar", qué datos del paciente le faltan: "Falta la edad" si no tiene edad registrada y "Falta la fecha de inicio" si no tiene fecha de inicio de tratamiento. Una historia con ambos faltantes SHALL mostrar los dos avisos. Inicio NO SHALL mostrar conteos de historias con datos faltantes ni la lista de pasos clínicos vacíos. La API (`GET /api/dashboard/me`) SHALL entregar, en cada historia para retomar, si le falta la edad y si le falta la fecha de inicio.

#### Scenario: Datos faltantes
- **WHEN** una historia incompleta no tiene edad ni fecha de inicio de tratamiento
- **THEN** su fila en "Para retomar" muestra "Falta la edad" y "Falta la fecha de inicio", y Inicio no muestra conteos de historias sin edad o sin fecha de inicio

#### Scenario: Falta solo la fecha de inicio
- **WHEN** una historia incompleta tiene edad pero no fecha de inicio
- **THEN** su fila muestra solo "Falta la fecha de inicio"

#### Scenario: Historia con todos los datos
- **WHEN** una historia incompleta tiene edad y fecha de inicio
- **THEN** su fila no muestra avisos de datos faltantes

#### Scenario: Sin pasos vacíos
- **WHEN** un tratante con historias incompletas abre Inicio
- **THEN** no ve una lista de pasos clínicos vacíos ni conteos de historias sin edad o sin fecha de inicio

### Requirement: Historias para retomar
Inicio del `USER` SHALL listar, en el primer plano y a todo el ancho, sus historias no completas (en progreso o sin calcular) más recientes por última modificación, hasta 5, con número, paciente, pasos clínicos con datos (solo si ya se calculó el avance) y fecha. Cada una SHALL tener un botón "Continuar en paso N" que abre la historia en su último paso trabajado, o en el paso 1 si no tiene, y SHALL mostrar los avisos de datos faltantes de su requisito.

#### Scenario: Retomar una historia
- **WHEN** un tratante tiene una historia incompleta cuyo último paso trabajado es el 6
- **THEN** aparece en "Para retomar" con el botón "Continuar en paso 6" y su enlace abre `/historias/<id>?paso=6`

#### Scenario: Retomar sin último paso
- **WHEN** una historia para retomar no tiene último paso trabajado
- **THEN** su botón dice "Continuar en paso 1" y abre `/historias/<id>?paso=1`

#### Scenario: Historia sin avance calculado
- **WHEN** una historia para retomar fue guardada antes de este cambio y no tiene avance calculado
- **THEN** su fila muestra número, paciente y fecha, sin texto de pasos con datos

#### Scenario: Todas completas
- **WHEN** todas sus historias tienen los 7 pasos clínicos con datos
- **THEN** "Para retomar" indica que no hay historias pendientes

#### Scenario: Orden de la pantalla
- **WHEN** un tratante con historias abre Inicio
- **THEN** "Para retomar" aparece antes que los indicadores de cupo y completas

## ADDED Requirements

### Requirement: Indicadores de completas y por terminar del tratante
Inicio SHALL mostrar al `USER` cuántas de sus historias están completas y cuántas le faltan por terminar. Una historia es **completa** si tiene datos en los 7 pasos clínicos (1–7); el paso 8 (Firmas) no cuenta, porque se completa a mano. Las historias en progreso y las guardadas antes de que se calculara su avance (sin calcular) SHALL contarse juntas como "por terminar". Inicio NO SHALL mostrar un promedio de pasos ni explicar cómo se calcula el avance.

#### Scenario: Completas y por terminar
- **WHEN** un tratante tiene una historia con datos en los pasos 1–7 (Firmas vacío), otra con 4 pasos y otra guardada antes de este cambio
- **THEN** Inicio muestra 1 completa y 2 por terminar

#### Scenario: Firmas no cuenta
- **WHEN** una historia tiene datos solo en los pasos 1–6 y en Firmas
- **THEN** figura por terminar y no cuenta como completa

#### Scenario: Historias sin calcular
- **WHEN** el tratante tiene 4 historias guardadas antes de este cambio y ninguna calculada
- **THEN** Inicio muestra 0 completas y 4 por terminar, sin ningún aviso sobre "sin calcular" ni promedio

## REMOVED Requirements

### Requirement: Completitud de las historias del tratante
**Reason**: Mostraba un promedio de pasos y el aviso "N sin calcular: se calculan al volver a guardarlas", que describen la implementación y no ayudan al tratante a decidir qué hacer.
**Migration**: Lo reemplaza "Indicadores de completas y por terminar del tratante"; el criterio de historia completa (7 pasos clínicos, Firmas no cuenta) se conserva.

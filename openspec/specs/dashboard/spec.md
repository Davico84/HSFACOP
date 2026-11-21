# dashboard Specification

## Purpose
Métricas de Inicio por rol, calculadas en el servidor con consultas agregadas (sin leer el contenido clínico): el tratante (`USER`) ve el avance de sus historias —cantidad, cupo, completitud sobre los 7 pasos clínicos, datos faltantes y qué retomar en su último paso—; el `ADMIN` ve solo métricas globales —cuentas, historias por mes, tratantes con más historias y cupos cerca del tope—. Reemplaza el dashboard de ejemplo de la plantilla.

## Requirements

### Requirement: Métricas del tratante en Inicio
Para un `USER`, Inicio SHALL mostrar el uso de su cupo ("N de M" o "sin límite") y un botón "Nueva historia" junto al saludo, calculados en el servidor sobre sus propias historias (`GET /api/dashboard/me`, solo `USER`; un `ADMIN` recibe `403`). La respuesta SHALL incluir el total de historias y las creadas en el mes en curso, y NO SHALL incluir historias de otros tratantes. Con el cupo lleno, "Nueva historia" SHALL quedar deshabilitado y decir por qué.

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
Inicio SHALL indicar al `USER`, en cada historia de "Para retomar", si le falta la edad ("Falta la edad") y la fecha de inicio de tratamiento ("Falta la fecha de inicio"), mostrando los dos avisos cuando faltan ambos. Inicio NO SHALL mostrar conteos de historias con datos faltantes ni la lista de pasos clínicos vacíos. `GET /api/dashboard/me` SHALL entregar ambos indicadores en cada historia para retomar.

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

### Requirement: Métricas globales del ADMIN en Inicio
Para un `ADMIN`, Inicio SHALL mostrar solo métricas globales calculadas en el servidor (`GET /api/dashboard/admin`); un `USER` que las pida SHALL recibir `403`. Cuentas: totales, activas, deshabilitadas y nuevas en el mes en curso. Historias: totales, creadas en el mes, completas, en progreso y sin calcular (criterio de completa del tratante), incluidas las de autor `ADMIN` o de cuentas deshabilitadas. De las cuentas solo se exponen id y nombre, no el correo.

#### Scenario: Usuarios
- **WHEN** hay 12 cuentas, 2 deshabilitadas y 3 creadas este mes
- **THEN** Inicio del ADMIN muestra 12 cuentas, 10 activas, 2 deshabilitadas y 3 nuevas

#### Scenario: Historias de un ADMIN y cuentas deshabilitadas
- **WHEN** un `ADMIN` es autor de 6 historias y un tratante deshabilitado tiene 9
- **THEN** las 15 cuentan en los totales; el ADMIN no aparece en tratantes con más historias y el deshabilitado sí, marcado "deshabilitada"

#### Scenario: USER pide las métricas globales
- **WHEN** un `USER` llama a `GET /api/dashboard/admin`
- **THEN** la API responde `403`

#### Scenario: El ADMIN no ve métricas de tratante
- **WHEN** un `ADMIN` abre Inicio
- **THEN** ve solo las métricas globales, sin "Para retomar" ni su cupo

### Requirement: Historias por mes y tratantes con más historias
Inicio del `ADMIN` SHALL mostrar las historias creadas por mes en los últimos 6 meses (incluido el actual, según la zona horaria de la app, con cero en los meses sin historias) y hasta 5 cuentas `USER` (activas o deshabilitadas, marcadas como tales) con más historias, desempatando por nombre, con su promedio de pasos clínicos con datos.

#### Scenario: Historias por mes
- **WHEN** se crearon 4 historias en mayo, ninguna en junio y 7 en octubre
- **THEN** las barras de los últimos 6 meses muestran 4, 0 y 7 en esos meses, rotuladas "may", "jun" y "oct"

#### Scenario: Corte de mes por zona horaria
- **WHEN** una historia se crea el 31 de mayo a las 21:00 hora de la clínica (1 de junio en UTC)
- **THEN** cuenta en mayo

#### Scenario: Tratantes con más historias
- **WHEN** hay 8 tratantes con historias
- **THEN** se muestran los 5 con más historias, de más a menos, con su completitud promedio

### Requirement: Cupos cerca del tope
Inicio del `ADMIN` SHALL listar las cuentas `USER` **activas** con el cupo lleno (también si lo creado lo supera o el cupo es 0) o usado al 80 % o más: las 10 más cerca del tope, las llenas primero, más el total de cuentas que cumplen la condición.

#### Scenario: Cupos cerca del tope
- **WHEN** un tratante usa 4 de 5 y otro 5 de 5
- **THEN** ambos aparecen en cupos, el lleno primero; un tratante sin cupo nunca aparece; uno con cupo 0, o con más historias que su cupo (cupo reducido), figura como lleno

#### Scenario: Cuenta deshabilitada con el cupo lleno
- **WHEN** un tratante deshabilitado tiene 5 de 5
- **THEN** no aparece en cupos (no puede crear historias)

#### Scenario: Muchos cupos cerca del tope
- **WHEN** 14 tratantes están al 80 % o más de su cupo
- **THEN** se muestran los 10 más cerca del tope y el total "14 tratantes"

### Requirement: Solicitudes de desbloqueo en Inicio del ADMIN
Inicio del `ADMIN` SHALL listar las solicitudes de desbloqueo pendientes, de la más antigua a la más nueva, hasta 10 más el total, con número de historia, paciente, tratante, fecha y motivo; cada una SHALL enlazar a la historia, donde el ADMIN desbloquea o descarta. Sin solicitudes SHALL indicar "No hay solicitudes de desbloqueo". La lista SHALL ser siempre un arreglo (vacío si no hay).

#### Scenario: Solicitudes pendientes
- **WHEN** hay 3 solicitudes de desbloqueo pendientes
- **THEN** Inicio del ADMIN las muestra de la más antigua a la más nueva, con su motivo y un enlace a cada historia

#### Scenario: Sin solicitudes
- **WHEN** no hay solicitudes pendientes
- **THEN** Inicio del ADMIN indica "No hay solicitudes de desbloqueo"

#### Scenario: Muchas solicitudes
- **WHEN** hay 14 solicitudes pendientes
- **THEN** se muestran las 10 más antiguas y el total "14 solicitudes"

#### Scenario: Solicitud resuelta
- **WHEN** el ADMIN desbloquea o descarta una solicitud y vuelve a Inicio
- **THEN** ya no aparece

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

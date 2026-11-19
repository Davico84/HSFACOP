## 0. Condiciones previas

- [x] 0.1 Confirmar con el responsable (por escrito en este change, sin datos sensibles) que el sistema deja de imprimir el nombre completo y los demás datos retirados, y que se escriben a mano; verificar que la nota existe
- [x] 0.2 Decidir qué ocurre con `update-orthodontic-records-encrypt-patient-identity` y `update-orthodontic-records-migrate-patient-identity` si este change se aplica primero, y anotarlo en el `proposal.md` de ambos; verificar que las notas existen
- [x] 0.3 Aplicar y archivar `update-backend-logging-no-patient-data` si no lo está, rebasar los deltas de este change con `MODIFIED` sobre los specs resultantes y volver a ejecutar `openspec validate update-orthodontic-records-pseudonymous-patient --strict`; verificar que pasa
- [x] 0.4 **Criterio de salida:** redactar el análisis de reidentificación de lo que queda (alias, sexo, edad, turma, tratante, fechas de modificación, fecha de inicio, texto libre), decidir por campo si se acepta, se limita o se elimina, y obtener la aceptación escrita del responsable con la afirmación exacta que puede sostener; sin este documento no se aplica ni se archiva el change; verificar que existe y está fechado

## 1. Backend: modelo y validación

- [ ] 1.1 Migración Flyway de expansión: columnas `patient_age` (0 a 99, opcional) y `identity_migrated_at` (marca de migración), sin renombrar ni borrar columnas; verificar con un test de migración sobre el esquema vigente sin pérdida de datos
- [ ] 1.2 Entidad, DTO y `RecordNormalizer`: aceptar alias, sexo y edad, rechazar con `400` los campos retirados y validar el alias (1 a 30 caracteres, hasta 2 palabras, sin 6 dígitos seguidos) y la edad (0 a 99, entera); verificar con los Scenario "Alias, sexo y edad válidos", "Alias con más de dos palabras", "Alias con un número largo", "Alias en los límites", "Edad fuera de rango" y "Campo retirado en la petición"
- [ ] 1.2b Tests de API con un cliente antiguo (`documentNumber`, `birthDate`, `address`, nombres de firma) en crear y en guardar, y consultas a la base y a los eventos, las respuestas de error, el tablero, las cachés y los registros para comprobar que ningún dato retirado se guarda ni se devuelve; verificar con los Scenario "Campo retirado en la petición" y "Respuestas, eventos y errores sin datos retirados"
- [ ] 1.2c Vectores compartidos del alias entre navegador y servidor (30/31 puntos de código, 2/3 palabras, espacios repetidos, tildes, emoji, número corto y largo); verificar con los Scenario "Espacios, tildes y números cortos", "Caracteres no permitidos" y "Conteo por caracteres Unicode"
- [ ] 1.3 `RecordAgeCalculator` pasa a validar el rango; el paso de firmas y la menarquia usan la edad registrada y las firmas dejan de guardar nombres; verificar con los Scenario "Apoderado firma por el paciente menor de edad", "Paciente menor de la edad mínima" y "Fecha de la primera menstruación inválida"
- [ ] 1.3b Tests de borde de la edad: 0, 17, 18, 99, nula y fuera de rango; cambio de la fecha de inicio tras imprimir y reimpresión; guardado concurrente de la edad desde dos pestañas e impresión simultánea (bloqueo por versión); verificar con los Scenario "Edades en los límites", "Cambio de la edad o de la fecha de inicio tras imprimir" y "Impresión y guardado simultáneos"
- [ ] 1.4 Búsqueda por alias y número, texto de búsqueda reconstruido sin datos retirados; verificar con los Scenario "Búsqueda por documento o número" y "Búsqueda sin tildes ni mayúsculas"
- [ ] 1.5 Candado: la primera impresión fija alias, sexo y edad; comparación canónica del alias; verificar con los Scenario de "Datos del paciente fijos tras imprimir" y "Comparación de los datos fijos"
- [ ] 1.6 Solicitud de desbloqueo con motivo de catálogo cerrado (`ALIAS`, `SEXO`, `EDAD`, `OTRO`) en solicitud y eventos; verificar con los Scenario "Motivo fuera del catálogo" y "Solicitudes y eventos sin texto libre"
- [ ] 1.7 Tablero: "sin edad" en lugar de "sin documento" y "sin fecha de nacimiento"; verificar con el Scenario "Datos faltantes"
- [ ] 1.8 Regenerar `contracts/openapi.json`; verificar que `mvn verify` pasa la comparación del contrato

## 2. Frontend

- [ ] 2.1 Paso 1: alias, sexo y edad escrita, con el aviso de no usar el nombre real y la confirmación con dos palabras; quitar documento, nacimiento, lugar, domicilio y celular; verificar con los Scenario "Aviso de nombre real" y "Sin edad" (Vitest)
- [ ] 2.2 Esquemas Zod y cliente de la API regenerado (`orval`); verificar que `pnpm validate` pasa
- [ ] 2.3 Paso de firmas sin campos de nombre ni parentesco; verificar con el Scenario "Apoderado firma por el paciente menor de edad"
- [ ] 2.4 Listado y tarjetas con el alias, sin documento, y búsqueda por alias o número con el transporte de `update-backend-logging-no-patient-data`; verificar con los Scenario "Listado en tarjetas" y "Búsqueda por documento o número" y con una prueba de red que ni el alias ni el número viajan en la URL, ni en los errores
- [ ] 2.4b Hojas de Moyers, Nance, Tanaka-Johnston y Wolford con el alias en lugar del nombre; nombre del archivo y título del PDF sin alias; verificar con los Scenario de "Análisis de Moyers", "Análisis de Nance" y "Hojas impresas de Tanaka-Johnston y Wolford" y comparando el PDF
- [ ] 2.5 Hoja 1 impresa con alias, sexo, edad y fecha de inicio, y líneas en blanco para los datos a mano; hoja de firmas con líneas en blanco; verificar con los Scenario "Datos del paciente a mano" y "Datos escritos sin líneas de llenado a mano" y comparando el PDF con Edge headless
- [ ] 2.6 Diálogo de desbloqueo con motivos del catálogo, sin texto libre; verificar con "Motivo fuera del catálogo" (Vitest + MSW)
- [ ] 2.7 Prueba e2e (Playwright) de crear una historia con alias, imprimir y reimprimir; comprobar en la red que ninguna petición lleva campos retirados; verificar que pasa

## 3. Migración de las historias existentes

- [ ] 3.1 Script administrativo único (no endpoint) con las condiciones de D8, transacción por historia, marca `identity_migrated_at` y la lista previa de alias para revisión y el informe de historias sin respaldar en la libreta local (solo informativo: pasada la fecha límite se borra igual); verificar con los Scenario "Migración correcta", "Historia sin fecha de nacimiento", "Nombre vacío, de una palabra o con partículas", "Reejecución e interrupción" y "Sin copia verificada o sin aprobación", "Cuentas deshabilitadas o de alumnos que se fueron" y "Autor que no copia antes de la fecha límite"
- [ ] 3.2 Reemplazar los motivos de desbloqueo y los eventos en texto libre por `OTRO` y borrar `patientSignatureName`, `guardianName` y `guardianRelationship` conservando los nombres de supervisores y tratante; verificar con los Scenario "Nombres de firma del paciente y del apoderado" y "Motivos de desbloqueo anteriores" y con una consulta que no encuentre las tres claves ni texto libre
- [ ] 3.2b Informe de historias con datos inconsistentes (edad frente a menarquia) y prueba de que el siguiente guardado se rechaza con `400`; verificar con el Scenario "Historia migrada con datos clínicos inconsistentes"
- [ ] 3.3 Migración Flyway de retiro de las columnas, con comprobación previa que aborta si queda alguna fila con valores; verificar con los Scenario "Retiro del esquema" y "Retiro con historias pendientes"
- [ ] 3.4 Inventariar y purgar las copias anteriores (artifacts, ramas de la base del proveedor, descargas), con fecha de corte y registro de quién lo verificó, y añadir al workflow de respaldo una comprobación de que el volcado no contiene las columnas retiradas ni nombres del paciente o apoderado en las firmas; verificar con los Scenario "Volcado sin columnas retiradas", "Purga de copias anteriores" y "Restauración de una copia previa al retiro" y con una copia nueva
- [ ] 3.5 Desplegar primero el binario que ya no mapea las columnas antiguas, esperar a que funcione sin errores, y solo entonces ejecutar el retiro; documentar que volver al binario anterior queda prohibido tras el retiro y probar el rollback en una base aislada con una copia; verificar que el arranque contra el esquema con y sin las columnas funciona

## 4. Integración

- [ ] 4.1 Actualizar `docs/domain.md` (glosario y ER del paciente) y `docs/vision.md` ("Estado de capacidades"); verificar que enlazan este change
- [ ] 4.2 `openspec validate update-orthodontic-records-pseudonymous-patient --strict`, `mvn verify` y `pnpm validate` en verde; verificar la salida de los tres

## 5. Ventana de copia a la libreta

- [ ] 5.1 Operación exclusiva del autor que devuelve `legacyIdentity` hasta la fecha límite de copia (nunca a `ADMIN` ni a coordinación en historias ajenas), con `Cache-Control: no-store`, sin registro del cuerpo ni de la caché del cliente, y cierre automático en la fecha límite o al migrar la historia; verificar con tests de slice de `403`/`404` en historia ajena, de fecha límite vencida, de historia migrada y de que el cuerpo no aparece en los registros

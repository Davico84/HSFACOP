## Why

La historia clínica guarda hoy el nombre completo, el documento, la fecha y el lugar de nacimiento, el domicilio y el celular del paciente en claro en el servidor. El servicio de hosting actual prohíbe datos sensibles en su plan y la Ley 29733 trata los datos de salud como sensibles. El cifrado de extremo a extremo (`update-orthodontic-records-encrypt-patient-identity`) resuelve el problema, pero es grande, lleva frases de paso y depende de una revisión legal. Este change es una **etapa 1 más simple**: el sistema deja de recibir esos datos y el paciente se identifica solo por un alias, su sexo y su edad en años. El papel firmado sigue siendo el registro oficial y conserva el nombre real, escrito a mano.

## What Changes

- El paciente se registra con un **alias** (una palabra o dos, sin apellidos), **sexo** y **edad en años al inicio del tratamiento**. La edad se escribe; ya no se calcula.
- **BREAKING**: el sistema deja de pedir y guardar documento (tipo y número), fecha de nacimiento, lugar de nacimiento, domicilio y celular del paciente; también deja de guardar los nombres de quienes firman (paciente o apoderado) en el contenido de la historia.
- El alias se valida: máximo 30 caracteres, máximo 2 palabras y sin secuencias de 6 o más dígitos. El formulario avisa que no debe escribirse el nombre real y comprueba los textos libres contra el alias solo como ayuda.
- La hoja 1 impresa muestra el alias, el sexo, la edad y la fecha de inicio, y deja **líneas en blanco** para escribir a mano el nombre completo, el documento, la fecha y el lugar de nacimiento, el domicilio y el celular. Igual la hoja de firmas deja en blanco los nombres de paciente y apoderado.
- La primera impresión fija alias, sexo y edad (antes fijaba nombre, documento, nacimiento, sexo y lugar).
- El motivo de la solicitud de desbloqueo pasa a un **catálogo cerrado** (sin texto libre), porque el texto libre se guardaba en la solicitud y en los eventos.
- Inicio del `USER` deja de contar historias "sin documento" y "sin fecha de nacimiento"; conserva "sin fecha de inicio".
- La búsqueda y el listado trabajan por alias y número de historia; ya no por nombre completo ni documento.
- Migración de las historias existentes (reales, algunas incompletas): el alias inicial es el nombre de pila más la inicial del primer apellido (editable), la edad se calcula una vez desde la fecha de nacimiento, y los datos que se retiran se borran **solo tras una copia de seguridad verificada y con aprobación escrita**. Las cuentas deshabilitadas o de alumnos que ya no están se borran sin copia, y los autores que no copian antes de la fecha límite pierden los datos digitales (quedan en el papel firmado). Se detalla en `design.md`.
- La cuenta del tratante conserva su propio documento y celular; sus reglas de formato se escriben en su propio requisito.

## Capabilities

### New Capabilities
- Ninguna.

### Modified Capabilities
- `orthodontic-records`: creación, datos del paciente, edad registrada, firmas, listado y búsqueda, hoja impresa, datos fijos tras imprimir, comparación de datos fijos, solicitud de desbloqueo y migración de las historias existentes.
- `dashboard`: datos faltantes del tratante y lista de solicitudes de desbloqueo del `ADMIN` sin documento ni nombre real.
- `users`: el documento de la cuenta ya no remite a las reglas del documento del paciente.
- `cloud-deployment`: las copias de seguridad no contienen identificadores del paciente tras el retiro, con fecha de corte y purga verificable.

## Impact

- Backend: entidad, DTO, `RecordNormalizer`, `RecordAgeCalculator` (deja de calcular), consultas del listado y del tablero, impresión y registro de eventos de desbloqueo; migración Flyway con borrado guardado.
- Frontend: paso 1 del formulario, paso de firmas, listado, hoja impresa (plantilla de la hoja 1 y de firmas), diálogo de desbloqueo, esquemas Zod y cliente de la API regenerado.
- `contracts/openapi.json`, `docs/domain.md` y `docs/vision.md`.
- **Relación con los otros changes:** es una alternativa más simple al cifrado de identidad. Puede ejecutarse **antes** (etapa 1), y entonces `update-orthodontic-records-encrypt-patient-identity` se reduce o se archiva según lo que decida el responsable. Comparte con él los requisitos "Solicitud de desbloqueo", "Listado y búsqueda de historias", "Datos del paciente fijos tras imprimir" y "Secciones clínicas de la fase 1": el segundo que se archive debe rebasar sus deltas con `MODIFIED` sobre el spec resultante. También conviene aplicar antes `update-backend-logging-no-patient-data`.

## Non-goals

- Cifrado de extremo a extremo ni frases de paso (viven en el otro change).
- Detectar con certeza que un alias es un nombre real: solo se avisa.
- Identificar a la misma persona en dos historias (ya no hay documento).
- Revisión legal bajo la Ley 29733: el responsable decidió el 2026-11-19 no hacerla y asumir el riesgo; la identificabilidad de alias, sexo y edad se analiza en el propio diseño.

## Decisiones del responsable (2026-11-19)
- El servidor deja de recibir y de imprimir nombre completo, documento, nacimiento, domicilio y celular. Al imprimir, el navegador completa esas líneas con la libreta local del dispositivo (`add-orthodontic-records-local-patient-notebook`); sin entrada en la libreta, quedan en blanco para escribirlas a mano. El papel firmado es el registro oficial (tarea 0.1).
- Este change y la libreta local se **despliegan en la misma entrega**: no debe haber un periodo en que todos impriman en blanco.
- `update-orthodontic-records-encrypt-patient-identity` y `update-orthodontic-records-migrate-patient-identity` quedan sin aplicar, como propuestas de reserva; cada uno lo anota en su `proposal.md` (tarea 0.2).

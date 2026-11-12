# Design

## Context

La historia guarda hoy `patient_name`, `document_type`, `document_number`, `birth_date`, `birth_place`, `address`, `phone` y `search_text` en claro, más los nombres de quien firma dentro de `content.signatures`. La edad se calcula con `RecordAgeCalculator` a partir de `birth_date` y decide quién firma (apoderado si hay menos de 18 años) y las reglas de la menarquia. Este change elimina esos datos del servidor y los sustituye por un alias, el sexo y una edad escrita. El papel firmado conserva el nombre real. Ver `proposal.md` y, como alternativa de mayor alcance, `update-orthodontic-records-encrypt-patient-identity`.

## Goals / Non-Goals

**Goals:**
- Que el servidor no reciba ni guarde nombre completo, documento, nacimiento, domicilio ni celular del paciente.
- Que el flujo clínico siga completo: firmas, menarquia, impresión, candado y desbloqueo.
- Migrar las historias reales sin perder lo clínico y sin dejar identidad en claro.

**Non-Goals:**
- Cifrado de extremo a extremo (otro change).
- Impedir técnicamente que el tratante escriba un nombre real como alias o dentro de un texto libre: solo se avisa.
- Enlazar historias del mismo paciente.

## Decisions

### D1. Qué se guarda
`patient_name` (la columna existente, sin renombrar, pasa a guardar el alias; el nombre del campo en la API es `patientAlias`), `patient_sex` (existente) y `patient_age` (entero 0 a 99, nuevo, opcional) más `treatment_start_date` y los datos clínicos de siempre. Se retiran `document_type`, `document_number`, `birth_date`, `birth_place`, `address` y `phone`. El texto de búsqueda se reconstruye solo con alias y número de historia.

### D2. Reglas del alias
Se normaliza con Unicode NFKC, se quitan espacios al inicio y al final y los espacios repetidos se reducen a uno. Largo de 1 a 30 **puntos de código** (igual en navegador y servidor), hasta 2 palabras separadas por espacio, solo letras, marcas, dígitos, guion y apóstrofo (sin emojis, signos ni caracteres de control), sin secuencias de 6 o más dígitos (evita pegar un documento). Vectores de prueba compartidos entre cliente y servidor. El servidor valida forma y límites; no puede saber si es un nombre real. El formulario avisa al escribir 2 palabras y compara el alias con las palabras de los campos de texto libre, como ayuda y no como garantía. Riesgo residual declarado: apodos, nombres de pila reales y nombres en notas.

### D3. La edad se escribe y deja de calcularse
La edad es "años cumplidos al inicio del tratamiento". `RecordAgeCalculator` deja de calcular y se convierte en validación del rango. Con la edad registrada el servidor decide si el paso de firmas pide apoderado (menos de 18) y valida la edad de la menarquia (8 a 18, y no mayor que la edad registrada). Sin edad se trata como adulta.

### D4. Firmas
El contenido de firmas deja de guardar nombre y parentesco del paciente o apoderado. El paso de firmas solo indica quién firma (según la edad) y la hoja impresa deja la línea en blanco para escribir nombre y parentesco a mano. Se borran exactamente `patientSignatureName`, `guardianName` y `guardianRelationship`; se conservan `supervisor1Name`, `supervisor2Name` y `treatingSignatureName`, que no son datos del paciente. La migración trata las versiones antiguas del contenido (claves ausentes o con otros nombres) y verifica por consulta que no queda ninguna de las tres claves en ninguna historia.

### D5. Hoja impresa
La hoja 1 imprime alias, sexo, edad y fecha de inicio con su dato, y deja líneas en blanco para nombre y apellidos, documento, lugar y fecha de nacimiento, domicilio y celular. El papel firmado es el registro oficial y conserva todo a mano. Si el responsable necesita el nombre impreso, es una decisión futura que implica volver a guardarlo (etapa 2 de cifrado).

### D6. Candado, comparación y desbloqueo
La primera impresión fija alias, sexo y edad. La comparación canónica sigue ignorando mayúsculas, tildes y espacios. El motivo del desbloqueo pasa a un catálogo cerrado (`ALIAS`, `SEXO`, `EDAD`, `OTRO`) porque el texto libre se guardaba en la solicitud y en los eventos y podía contener un nombre o un documento. Los motivos ya guardados se reemplazan por `OTRO` al migrar.

### D7. Búsqueda y tablero
El listado busca por alias y número de historia. El transporte de la búsqueda es el que deja `update-backend-logging-no-patient-data` (texto en el cuerpo de un `POST`, sin texto en la dirección del navegador); la tarea 0.3 rebasa este change sobre ese contrato y una prueba de red verifica que ni el alias ni el número viajan en la URL. El tablero deja de contar "sin documento" y "sin fecha de nacimiento" y cuenta "sin edad". Los `ADMIN` y la coordinación ven el alias, no un nombre real.

### D8. Migración de las historias existentes
Hay historias reales, algunas incompletas, con identidad en claro. La migración se hace en tres tiempos, **todos fuera de la API**:
1. **Expansión (Flyway).** Añade `patient_age` y deja las columnas antiguas intactas. El servidor nuevo **escribe** solo los campos nuevos y nunca vuelve a escribir las antiguas. Hasta la **fecha límite de copia** que fije el responsable, devuelve las antiguas **únicamente al autor** de cada historia, en un objeto aparte (`legacyIdentity`) de una operación exclusiva, con `Cache-Control: no-store` y sin registrarlo, para que el autor pueda copiarlas a su libreta local (`add-orthodontic-records-local-patient-notebook`). Pasada la fecha límite, o con la historia migrada, deja de devolverlas. No borra nada.
2. **Acción administrativa única** (script, no endpoint). Solo corre con copia de seguridad verificada, aprobación escrita del responsable, lista de historias revisada y confirmación interactiva. **Decisiones del responsable:** las historias de cuentas deshabilitadas o de alumnos que ya no están se borran sin copia; las de autores que no copian antes de la fecha límite se borran igual pasada la fecha, sin esperarlos. Cada historia se procesa en **su propia transacción** y termina marcada con `identity_migrated_at`; esa marca, no la edad ni el alias, decide si se omite al reejecutar. Por historia: el nombre normalizado (NFKC, sin espacios sobrantes) se parte en palabras y se quitan las partículas (`de`, `del`, `la`, `las`, `los`, `y`, `san`, `santa`); alias = primera palabra + espacio + inicial de la segunda ("Ana Q"), o solo la primera si no hay segunda, truncado a 30 caracteres; si el nombre es nulo, vacío o solo partículas, el alias es "Paciente". Es un valor inicial que el tratante puede cambiar. La edad se calcula una vez a la fecha de inicio (o a la de la migración si no hay) desde la fecha de nacimiento, y queda vacía si no hay fecha. Los motivos de desbloqueo y los eventos en texto libre pasan a `OTRO`. Se borran `patientSignatureName`, `guardianName` y `guardianRelationship` (D4). Las columnas antiguas quedan en `NULL`. **Historias inconsistentes:** la migración no corrige el contenido clínico; si la edad calculada contradice la menarquia ya guardada, conserva ambos datos, la cuenta en el informe y el siguiente guardado se rechaza con `400` hasta que el tratante la corrija. Una historia con candado de impresión conserva su `patientLockedAt` y fija el alias y la edad resultantes. Registra solo conteos.
3. **Retiro (Flyway guardado).** Elimina las columnas antiguas solo si ninguna historia tiene valores en ellas; en caso contrario aborta con un error sin valores.

Las copias de seguridad anteriores contienen la identidad en claro: se inventarían y se purgan tras el retiro, como en `update-orthodontic-records-migrate-patient-identity`.

### D9. Compatibilidad entre changes
- Este change **no** requiere el cifrado. Si se aplica primero, el change de cifrado queda reducido a lo que el responsable decida conservar (por ejemplo, nombre cifrado opcional) o se archiva sin aplicar.
- Comparte requisitos con el change de cifrado ("Solicitud de desbloqueo", "Listado y búsqueda de historias", "Datos del paciente fijos tras imprimir", "Secciones clínicas de la fase 1") y con `update-backend-logging-no-patient-data`; el segundo en archivarse debe rebasar con `MODIFIED` sobre el spec resultante y volver a validar.
- Rollback: la expansión no renombra ni borra columnas, así que antes del retiro se puede volver al binario anterior. **Después del retiro está prohibido volver al binario anterior**, que mapea columnas que ya no existen: solo se restaura un par base + binario compatible desde una copia verificada, en un entorno aislado. El retiro solo corre cuando el binario nuevo, que ya no mapea esas columnas, lleva funcionando sin errores (tarea 3.5).
- Copias de seguridad: la capacidad `cloud-deployment` gana un requisito de copias sin identificadores del paciente, con fecha de corte y purga verificable.

## Risks / Trade-offs

- **[Alias que es un nombre real]** → aviso, límite de palabras y comprobación contra textos libres; riesgo residual declarado al responsable.
- **[Reidentificación por combinación]** → alias, sexo, edad, turma, tratante y fechas de modificación pueden identificar en un grupo pequeño, sobre todo para quien ya conoce la clínica (por ejemplo el `ADMIN`). El análisis campo por campo y su aceptación escrita por el responsable son **criterio de salida**: sin ellos el change no se aplica ni se archiva. La afirmación que se puede sostener es "el servidor no guarda nombre completo, documento, nacimiento, domicilio ni celular del paciente", no "el servidor no guarda datos identificables".
- **[El alias inicial no es perfecto]** → nombres compuestos ("María José Quispe") dan "María J" y apellidos compuestos pueden dar otra inicial; es aceptable porque el alias no tiene que ser único ni exacto y el tratante lo puede cambiar. Nombre de pila más inicial identifica menos que el apellido completo. Quien ejecuta la acción ve antes la lista de alias resultantes (sin otros datos) para revisarla antes de aprobar.
- **[Pérdida de datos del paciente]** → el papel firmado los conserva; la copia verificada antes del borrado es condición.
- **[Se pierde la búsqueda por nombre y documento]** → se acepta; se busca por alias o número.
- **[Texto libre con nombres]** → sigue siendo riesgo residual; el otro change define un control adicional que puede reutilizarse.
- **[Aprobación externa pendiente]** → la respuesta del proveedor de nube y la revisión legal siguen siendo necesarias para dar por resuelto el tema de datos sensibles.

## Migration Plan

1. Tomar y verificar una copia; anotar cuántas historias hay.
2. Desplegar la expansión (columna nueva, servidor que escribe solo el formato nuevo).
3. Revisar con el responsable la lista previa de alias y aprobar por escrito.
4. Ejecutar la acción administrativa; verificar conteos.
5. Con cero historias con valores antiguos, desplegar el retiro de columnas.
6. Inventariar y purgar copias anteriores; comprobar que una copia nueva no contiene identidad en claro.

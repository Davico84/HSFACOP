# Design

## Context

Tras `update-orthodontic-records-pseudonymous-patient`, el servidor guarda el alias, el sexo y la edad, y el papel firmado conserva el nombre real, escrito a mano. La impresión se hace en el navegador (`RecordPrintFeature.tsx`, `printStyle.ts`, `window.print`) y el servidor solo registra que se imprimió. Eso permite una libreta local que complete la hoja sin que el dato pase por el servidor. El frontend no usa hoy ninguna librería de IndexedDB ni de cifrado; Web Crypto está en el navegador.

## Goals / Non-Goals

**Goals:**
- Que el tratante imprima la hoja con el nombre real y busque por nombre sin que el servidor reciba esos datos.
- Respaldar y trasladar la libreta entre dispositivos con un archivo cifrado.
- Dejar claro al usuario qué puede perder y cómo evitarlo.

**Non-Goals:**
- Sincronización por el servidor, cifrado en reposo de la libreta y protección contra un frontend o una extensión comprometidos.
- Recuperar una libreta sin archivo exportado.

## Decisions

### D1. Almacenamiento
Base IndexedDB `hsfacop-notebook`, almacén `entries` con clave `[accountId, recordId]` y los campos de la libreta más `recordNumber` (el AEO-NNNN de la historia), `revision` (entero que sube en cada guardado), `updatedAt` (ISO, solo informativo), `exportedAt` y `schemaVersion`. Al mostrar o imprimir se compara `recordNumber` con el que devuelve el servidor para ese identificador; si no coincide, la entrada se ignora y se avisa (protege contra bases restauradas o entornos distintos que reutilicen identificadores numéricos). Se valida con un esquema Zod al leer y al importar. No se usa una librería externa de almacenamiento (IndexedDB nativo con un envoltorio pequeño propio). Las claves incluyen la cuenta para que otra cuenta del mismo navegador no vea las entradas; es separación lógica, no un control de seguridad.

### D2. Qué guarda
Nombre completo, tipo y número de documento (mismas reglas de formato que tenía el servidor: DNI 8 dígitos, carné de extranjería 9, pasaporte 6 a 12), fecha y lugar de nacimiento, domicilio, celular, y nombre y parentesco de quien firma. Todos opcionales. La fecha de nacimiento no recalcula la edad del servidor: la edad escrita es la que manda.

### D3. Qué nunca sale
Ninguno de esos valores se envía: ni en el cuerpo, ni en la URL, ni en cabeceras, ni en el título del documento (`document.title`) ni en el nombre propuesto del PDF, ni en `console`, ni en eventos de analítica o de errores. Una prueba de red (Playwright) recorre guardar, imprimir, buscar, exportar e importar y falla si algún valor de la libreta aparece en una petición. El registro de impresión del servidor sigue enviando solo el identificador y la marca de avance.

### D4. Impresión
La hoja 1 y la de firmas leen la entrada de la libreta de la cuenta y de la historia al armar la vista de impresión; sin entrada, dejan las líneas en blanco. La unión ocurre solo en el DOM de impresión.

### D5. Exportación
Archivo `.hsflibreta` (JSON) con `{ v: 1, kdf: { alg: "PBKDF2-SHA256", iter, salt }, enc: { alg: "AES-GCM", iv, ct } }`. El **AAD es una cadena canónica** que autentica todo el sobre: `hsfacop:notebook:v1|<accountId>|PBKDF2-SHA256|<iter>|<salt>|AES-GCM|<iv>`; cambiar cualquiera de esos valores hace fallar el descifrado. Cada exportación genera un **IV aleatorio de 96 bits y una sal de 16 bytes** con `crypto.getRandomValues`; nunca se reutilizan, y una prueba exporta 100 veces y comprueba la unicidad. Frase generada por la aplicación (6 palabras de una lista de 2 048, unos 66 bits), mostrada una sola vez con confirmación de que se guardó; no hay frases elegidas por el usuario. Iteraciones PBKDF2 ≥ 600 000, versionadas. Nombre del archivo `libreta-AAAAMMDD.hsflibreta`, sin datos del paciente. Un archivo no se sincroniza ni se sube a ningún sitio.

### D6. Importación
El navegador lee el archivo (máximo 5 MiB), valida versión, algoritmo y parámetros contra una lista permitida, descifra, comprueba que `aad` es la cuenta actual y valida cada entrada con Zod. Combina por clave con una política **independiente del reloj**: gana la entrada con mayor `revision`; con igual `revision` y contenido distinto se conserva la local y se cuenta un conflicto; una `updatedAt` posterior a un día después de ahora rechaza el archivo. **Límites** que se verifican antes de abrir la transacción: 5 MiB de archivo, 5 000 entradas, 200 caracteres por campo y 5 niveles de JSON. Todos los fallos (frase, GCM, AAD, versión, algoritmo, cuenta, esquema, límites) muestran el mismo mensaje "No se pudo abrir el archivo"; el detalle va solo a un diagnóstico local sin datos del paciente. Los campos importados se tratan como texto (se escapan al imprimir) y se parsean con un JSON que ignora `__proto__` y `constructor`. Las entradas de historias que no son del usuario (según la lista de sus historias) se omiten y se cuentan. Cualquier fallo responde con un mensaje genérico y no escribe nada: la importación es **atómica** (todo o nada, en una transacción de IndexedDB).

### D7. Pérdida y respaldo
La aplicación pide `navigator.storage.persist()` y muestra un aviso en el primer guardado. Safari puede borrar el almacenamiento de un sitio sin uso tras 7 días, por lo que el recordatorio de exportar a los 7 días con cambios es parte del producto, no un adorno. Si una historia antes tenía entrada y ya no, el formulario lo muestra como libreta vacía con la opción de importar, no como error.

### D8. Equipo compartido
Ajuste "Este equipo es compartido" (guardado en el dispositivo): al cerrar sesión y tras 15 minutos sin actividad, ofrece exportar y borra la libreta. Exportar, importar, imprimir y borrar toman un bloqueo (Web Locks, con `BroadcastChannel` como alternativa) y la actividad de cualquier pestaña reinicia el plazo en todas: el borrado espera a la operación en curso o la cancela sin dejar un archivo parcial. "Borrar la libreta de este dispositivo" está siempre disponible y pide confirmación. No hay cifrado en reposo; se recomienda el cifrado del disco del equipo.

### D9. Búsqueda local
La búsqueda por nombre o documento recorre la libreta en memoria con la normalización de siempre (sin mayúsculas ni tildes). Las coincidencias dan identificadores de historia y el listado se pide al servidor con esos identificadores (hasta 50), sin el texto. **Fuga residual declarada:** el servidor aprende qué conjunto de historias se consultó, que junto con el alias, la turma y las fechas podría sugerir el motivo; se mitiga ordenando la petición por identificador y respondiendo como el listado normal, sin marcar que es una búsqueda. Esto reutiliza el contrato de búsqueda de `update-backend-logging-no-patient-data` ampliándolo con un filtro por identificadores; se define en la tarea 0.2.

### D10. Copia de las historias existentes (decisión tomada)
Hasta la **fecha límite de copia** que fija el responsable, el servidor devuelve al autor, y solo a él, los datos antiguos de su historia en una operación exclusiva (`legacyIdentity`, `Cache-Control: no-store`, sin registrar el cuerpo ni dejarlo en cachés del cliente); `ADMIN`, coordinación y otros usuarios reciben `404`. La aplicación ofrece "Pasar a mi libreta": lee los campos, los guarda localmente, **exporta un archivo cifrado**, lo descifra en memoria y compara campo por campo. Solo con esa verificación marca la historia como respaldada (`notebook_backup_confirmed_at`, sin datos). Una libreta local sin archivo verificado **no basta**, porque el navegador puede borrarla antes de la migración. La migración administrativa de `update-orthodontic-records-pseudonymous-patient` informa cuántas historias por autor siguen sin respaldo antes de borrar. Es solo informativo: el responsable decidió que pasada la fecha límite se borra igual, y que las cuentas deshabilitadas o de alumnos que ya no están se borran sin copia. Si la historia cambia de autor durante la copia, la operación se cancela.

### D11. Relación con los otros changes
- **Con el change del alias:** se aplica después o en la misma entrega. Al archivar, la hoja impresa se modifica con `MODIFIED` sobre el spec resultante.
- **Con el change de cifrado:** son alternativas en el traslado entre dispositivos. Si se aplica el cifrado, la libreta queda como respaldo opcional.
- **Con `update-backend-logging-no-patient-data`:** la búsqueda local se apoya en su contrato de búsqueda por `POST`.

## Open Questions

1. **Fecha límite de copia.** Decidido (2026-11-19): la ventana dura **14 días** desde el despliegue de la libreta; la fecha exacta se escribe al desplegar. Mientras dura, el servidor conserva y devuelve datos antiguos al autor. Cuanto más corta, menos tiempo de exposición; 14 días permiten que cada tratante entre al menos una vez y exporte su respaldo. Falta fijarla por escrito en este change y en el del alias (tarea 0.1).
2. **Frase de exportación generada.** Si más adelante se aplica el change de cifrado, conviene compartir la lista de palabras y el código de generación para no duplicarlos.
3. **Límite de entradas.** El tope de 5 000 se revisa tras medir memoria y tiempo de importación con cientos de entradas.

## Risks / Trade-offs

- **[Pérdida de la libreta]** → aviso, recordatorio de exportar a los 7 días, almacenamiento persistente y exportación; sin archivo no hay recuperación y se declara.
- **[Equipos compartidos]** → modo compartido y borrado; sin cifrado en reposo, quien use el mismo perfil del navegador puede leer los datos hasta que se borren.
- **[Archivo exportado]** → sin la frase es ilegible. Una frase de 6 palabras (2 048^6, unos 66 bits) con PBKDF2-SHA256 de 600 000 iteraciones obliga a un atacante a unas 7·10^19 pruebas de 600 000 iteraciones cada una; con un ritmo optimista de 10^5 pruebas por segundo por tarjeta gráfica no es viable con medios razonables, y se acepta ese riesgo por escrito (tarea 0.3). PBKDF2 no es resistente en memoria; reevaluar Argon2id si hace falta; la frase se muestra una sola vez y el archivo no debe enviarse por correo ni guardarse en nubes públicas (aviso en pantalla).
- **[Frontend o extensión comprometidos]** → pueden leer la libreta; no cubierto, igual que en el change de cifrado; CSP y dependencias fijadas.
- **[Datos personales en el dispositivo]** → siguen siendo datos de salud bajo la Ley 29733, ahora en un dispositivo bajo control del tratante; la revisión legal debe cubrirlo (tarea 0.4).
- **[Multi-dispositivo manual]** → el traslado depende de que el usuario exporte e importe; se acepta como límite.
- **[Escritura de datos en el servidor por error]** → prueba de red automática con fixtures por fragmentos (apellido, últimos 4 dígitos, fragmento del domicilio, nombre normalizado sin tildes) que inspecciona cuerpo, URL, cabeceras, registros, cachés, título del documento, nombre del archivo y mensajes de error, y revisión de DTO, registros y eventos.
- **[Marca de respaldo falsa]** → solo se marca tras exportar y verificar el archivo (D10); el borrado de la libreta después no cambia la marca, pero el archivo existe.
- **[Reloj de un dispositivo]** → el orden de importación usa `revision`, no la fecha.

## Migration Plan

1. Fijar la fecha límite de copia y aplicar primero `update-orthodontic-records-pseudonymous-patient`, que ya devuelve los datos antiguos solo al autor hasta esa fecha.
2. Desplegar la libreta (solo frontend y la marca de copia).
3. Los autores pasan sus historias existentes a la libreta y exportan un archivo de respaldo.
4. El responsable revisa el conteo de historias sin copiar y recién entonces ejecuta la migración administrativa del change del alias.
5. Rollback: la libreta es local y opcional; desactivarla no afecta a las historias del servidor.

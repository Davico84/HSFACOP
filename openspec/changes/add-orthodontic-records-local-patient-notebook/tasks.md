## 0. Condiciones previas

- [x] 0.1 La ventana de copia dura 14 días desde el despliegue de la libreta y la fecha exacta se escribe en `LEGACY_COPY_DEADLINE` al desplegar (decidido el 2026-11-19, ver D10 y `docs/deployment.md` §7); `update-orthodontic-records-pseudonymous-patient` (D8 y tarea 5.1) la lee de esa misma configuración y devuelve los datos antiguos solo al autor hasta esa fecha. Verificado: ambos documentos dicen lo mismo y `openspec validate --strict` pasa en los dos. Antes, fijaba con el responsable, por escrito, la fecha límite de copia (D10) y confirmar que `update-orthodontic-records-pseudonymous-patient` (D8 y tarea 5.1) devuelve los datos antiguos solo al autor hasta esa fecha; verificar que ambos documentos dicen lo mismo y que `openspec validate --strict` pasa en los dos
- [x] 0.2 Rebasado el 2026-11-19 sobre `main` (con `update-backend-logging-no-patient-data` ya archivado) y sobre el change del alias, que se implementan en la misma rama y se despliegan juntos: la modificación de "Datos en la hoja impresa" ya vive en el delta del alias (libreta si hay entrada, líneas en blanco si no) y el contrato de búsqueda con identificadores se modifica en `specs/orthodontic-records/spec.md` de este change; `openspec validate --strict` pasa. Antes decía: **Este change no se aplica antes de archivar** `update-backend-logging-no-patient-data` y `update-orthodontic-records-pseudonymous-patient`; después, rebasar este change (`MODIFIED` de "Datos en la hoja impresa" y del contrato de búsqueda con filtro por identificadores) y volver a ejecutar `openspec validate add-orthodontic-records-local-patient-notebook --strict`; verificar que pasa
- [x] 0.3 Límites aceptados por el responsable el 2026-11-19 al ordenar aplicar la libreta (nota en `limites-aceptados.md`, sin datos sensibles). Antes: confirmar con el responsable que la libreta es opcional y que acepta por escrito sus límites (un dispositivo, sin cifrado en reposo, sin recuperación sin archivo, frase de 66 bits con PBKDF2 y la fuga residual de identificadores en la búsqueda); verificar que la nota existe en este change, sin datos sensibles
- [x] 0.4 Revisión legal bajo la Ley 29733: el responsable decidió el 2026-11-19 no hacerla y asumir ese riesgo; los datos guardados en el dispositivo del tratante siguen siendo datos personales de salud. Verificar que esta nota consta en este change

## 1. Frontend: libreta local

- [x] 1.1 Módulo `patientNotebook` (`modules/frontend/src/modules/records/notebook/`): envoltorio de IndexedDB, esquema Zod de la entrada (con reglas de documento), clave `[accountId, recordId]`, lectura, escritura, borrado y listado; verificar con tests (Vitest + `fake-indexeddb`) de los Scenario "Guardar en la libreta", "Documento con formato incorrecto" y "Otra cuenta en el mismo dispositivo"
- [ ] 1.1b Matriz de capacidades: sin IndexedDB, sin `crypto.subtle`, cuota llena, modo privado, actualización bloqueada por otra pestaña y `storage.persist` denegado, con mensajes visibles y sin guardado alternativo; verificar con los Scenario de "Libreta no disponible en el navegador" y con una prueba de actualización bloqueada con dos pestañas
- [ ] 1.1c Entrada con `recordNumber` y `revision`; ignorar la entrada si el número no coincide con el de la historia; verificar con el Scenario "Entrada de otra historia con el mismo identificador"
- [ ] 1.2 Paso 1: campos "solo en este dispositivo" (nombre, documento, nacimiento, lugar, domicilio, celular) y datos de quien firma en el paso de firmas, con aviso de que no se envían; verificar con los Scenario "Historia sin libreta" y "Guardar en la libreta" (Vitest + MSW comprobando que ninguna petición los lleva)
- [ ] 1.3 Aviso del primer guardado, petición de `navigator.storage.persist()` y recordatorio de exportar tras 7 días; verificar con los Scenario "Primer uso", "Recordatorio" y "El navegador borró la libreta"
- [ ] 1.4 Alias sugerido desde el nombre de la libreta (nombre de pila más inicial del primer apellido, sin partículas), editable y calculado en el navegador; verificar con los Scenario de "Alias sugerido desde la libreta" y que ninguna petición lleva el nombre

## 2. Frontend: impresión

- [ ] 2.1 La hoja 1 y la hoja de firmas leen la libreta y completan nombre, documento, nacimiento, domicilio, celular y firmantes; sin entrada, líneas en blanco; verificar con los Scenario "Imprimir con libreta" e "Imprimir sin libreta" y comparando el PDF con Edge headless
- [x] 2.2 Título del documento y nombre propuesto del PDF sin datos del paciente ni alias; verificar con el Scenario "Título y archivo del PDF"
- [x] 2.3 Comprobar que la petición que registra la impresión lleva solo el identificador y la marca de avance; verificar con el Scenario "Registro de la impresión"
- [x] 2.4 Tomar una copia de la entrada antes de registrar la impresión, abortar sin registrar ni fijar si la lectura falla, y escapar todos los campos al imprimir (sin HTML ni scripts); verificar con los Scenario "Fallo de lectura de la libreta al imprimir" y "Entrada que cambia mientras se imprime" y con un test de entradas con `<script>` e imágenes

## 3. Frontend: exportar e importar

- [ ] 3.0 AAD canónico del sobre (versión, cuenta, KDF, iteraciones, sal, algoritmo, IV), IV de 96 bits y sal de 16 bytes aleatorios en cada exportación; verificar con los Scenario "Exportaciones repetidas" (100 exportaciones sin repetir) y "Parámetros alterados"
- [ ] 3.1 Generador de la frase de 6 palabras (lista de 2 048) y exportación con PBKDF2-SHA256 (≥ 600 000 iteraciones medidas en el dispositivo de referencia) y AES-GCM, `aad` con la cuenta y nombre `libreta-AAAAMMDD.hsflibreta`; verificar con los Scenario "Exportar", "Archivo ilegible sin la frase" y "Libreta vacía" y con vectores de prueba
- [ ] 3.2 Importación atómica: tamaño máximo 5 MiB, versión, algoritmo y parámetros permitidos, `aad`, validación por entrada, combinación por `revision`, rechazo de fechas futuras, límites de 5 000 entradas, 200 caracteres por campo y 5 niveles de JSON antes de abrir la transacción, un único mensaje genérico para todos los fallos, JSON sin `__proto__` ni `constructor` y omisión de historias ajenas; verificar con los Scenario "Reloj desajustado o fecha futura", "Archivo con demasiadas entradas o campos largos" y los siguientes "Importar en otro dispositivo", "Entradas en conflicto", "Frase incorrecta o archivo alterado", "Archivo de otra cuenta, de versión futura o demasiado grande" y "Entradas de historias ajenas"
- [ ] 3.3 Aviso de no enviar el archivo por correo ni guardarlo en nubes públicas; verificar con una prueba de la pantalla de exportación

## 4. Frontend: equipo compartido y búsqueda

- [ ] 4.0 Coordinación entre pestañas con Web Locks (o `BroadcastChannel`) para exportar, importar, imprimir y borrar, con la actividad compartida; verificar con el Scenario "Borrado mientras otra pestaña exporta" y una prueba con dos pestañas
- [ ] 4.1 Ajustes: "Este equipo es compartido", "Borrar la libreta de este dispositivo" con confirmación, borrado al cerrar sesión y tras 15 minutos de inactividad con oferta de exportar; verificar con los Scenario "Borrar la libreta", "Cierre de sesión en equipo compartido" e "Inactividad en equipo compartido"
- [ ] 4.2 Búsqueda local por nombre o documento, sin mayúsculas ni tildes, con listado pedido por identificadores (hasta 50); verificar con los Scenario "Buscar por nombre", "Sin coincidencias o sin libreta" y "Más de 50 coincidencias"

## 5. Backend: marca de copia

- [ ] 5.1 Columna `notebook_backup_confirmed_at` (sin datos del paciente) y operación para que el autor marque su historia como respaldada; la operación de datos antiguos del autor (tarea 5.1 del change del alias) responde `404` a otros usuarios, con `Cache-Control: no-store` y sin registro del cuerpo; verificar con los Scenario "Datos antiguos solo para el autor" y "Fecha límite vencida"; el contrato de búsqueda acepta una lista de identificadores (hasta 50); verificar con tests de slice de acceso por autor (`403`/`404` en historia ajena) y de lista de identificadores, y regenerar `contracts/openapi.json` y el cliente (`orval`)
- [ ] 5.2 Los registros, eventos y errores del backend no incluyen datos de la libreta; verificar con un test que inspecciona la salida del logger

## 6. Copia de las historias existentes

- [ ] 6.1 Acción "Pasar a mi libreta": lectura de `legacyIdentity`, escritura local, exportación del archivo cifrado, descifrado en memoria y comparación campo por campo, y solo entonces marca de respaldada; verificar con los Scenario "Copiar, exportar y verificar", "Copia sin respaldo", "Historia ya migrada" y "Cambio de autor durante la copia"
- [ ] 6.2 Informe para el responsable (solo informativo; pasada la fecha límite se borra igual) con cuántas historias por autor siguen sin copiar, sin datos del paciente, para consultarlo antes de la migración administrativa; verificar que el informe no muestra ningún valor del paciente
- [ ] 6.3 Prueba e2e de la secuencia copia local → marca de respaldo → fin de la fecha límite → migración, con fallo de red al marcar y migración concurrente: la marca es idempotente, no se borra nada antes de la fecha límite y la operación del autor se cierra al migrar; verificar el resultado de cada paso

## 7. Integración

- [ ] 7.1 Prueba e2e (Playwright) de guardar, imprimir, buscar, exportar e importar entre dos contextos del navegador, con fixtures que incluyen fragmentos (apellido, últimos 4 dígitos, fragmento del domicilio, nombre sin tildes), comprobando cuerpo, URL, cabeceras, registros, cachés, título del documento, nombre del archivo y mensajes de error; verificar que pasa y que la prueba falla si se introduce a propósito un fragmento en una URL
- [ ] 7.2 Actualizar `docs/domain.md`, `docs/frontend.md` y `docs/vision.md` ("Estado de capacidades"); verificar que enlazan este change
- [ ] 7.3 `openspec validate add-orthodontic-records-local-patient-notebook --strict`, `mvn verify` y `pnpm validate` en verde; verificar la salida de los tres

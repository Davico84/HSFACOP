# Spec Delta

## ADDED Requirements

### Requirement: Paciente identificado por alias, sexo y edad
La historia SHALL identificar al paciente solo por un alias, su sexo y su edad en años al inicio del tratamiento (0 a 99), escritos por el tratante. El alias SHALL normalizarse (NFKC, sin espacios sobrantes) y tener de 1 a 30 caracteres Unicode, hasta 2 palabras, solo letras, marcas, dígitos, guion y apóstrofo, y ninguna secuencia de 6 o más dígitos. El servidor NO SHALL recibir ni guardar nombre completo, documento, fecha o lugar de nacimiento, domicilio ni celular del paciente.

#### Scenario: Alias, sexo y edad válidos
- **WHEN** el tratante guarda el alias "Mateo", sexo masculino y edad 13
- **THEN** la historia guarda esos tres datos y los muestra en el paso 1 y en la hoja impresa

#### Scenario: Alias con más de dos palabras
- **WHEN** se envía el alias "Mateo Quispe Rojas"
- **THEN** la API responde `400` con el error en el alias y no guarda nada

#### Scenario: Alias con un número largo
- **WHEN** se envía el alias "Mateo 74125896"
- **THEN** la API responde `400` con el error en el alias y no guarda nada

#### Scenario: Alias en los límites
- **WHEN** se guarda un alias de 30 caracteres y otro de 31
- **THEN** el de 30 se guarda y el de 31 responde `400`

#### Scenario: Espacios, tildes y números cortos
- **WHEN** se guarda el alias "  Ana   María " o "José 12"
- **THEN** el primero se guarda como "Ana María" (2 palabras) y el segundo se guarda tal cual (el número tiene menos de 6 dígitos)

#### Scenario: Caracteres no permitidos
- **WHEN** se envía un alias con un emoji, un carácter de control o el signo "@"
- **THEN** la API responde `400` con el error en el alias y no guarda nada

#### Scenario: Conteo por caracteres Unicode
- **WHEN** se envía un alias de 30 letras con tilde y otro de 31
- **THEN** el de 30 se guarda y el de 31 responde `400`, igual en el navegador y en el servidor

#### Scenario: Edad fuera de rango
- **WHEN** se envía la edad -1, 100 o 12,5
- **THEN** la API responde `400` con el error en el campo de la edad y no guarda nada

#### Scenario: Edades en los límites
- **WHEN** se guarda la edad 0, 17, 18 y 99
- **THEN** todas se guardan; con 17 el paso de firmas pide apoderado y con 18 pide al paciente

#### Scenario: Cambio de la edad o de la fecha de inicio tras imprimir
- **WHEN** el tratante cambia la fecha de inicio de tratamiento de una historia ya impresa
- **THEN** se guarda sin tocar la edad, que no se recalcula, y solo cambia con un desbloqueo

#### Scenario: Respuestas, eventos y errores sin datos retirados
- **WHEN** se piden la historia, el listado, el tablero, los eventos de desbloqueo y una respuesta de error de un guardado inválido
- **THEN** ninguno contiene documento, fecha o lugar de nacimiento, domicilio, celular ni nombres de firma del paciente o apoderado

#### Scenario: Campo retirado en la petición
- **WHEN** un cliente antiguo envía `documentType`, `documentNumber`, `birthDate`, `birthPlace`, `address` o `phone` del paciente, o nombres de firma del paciente o apoderado dentro del contenido
- **THEN** la API responde `400` y no guarda nada, en crear y en guardar

#### Scenario: Aviso de nombre real
- **WHEN** el tratante escribe en el alias dos palabras o un texto que coincide con una palabra de un texto libre de la historia
- **THEN** el formulario avisa que el alias no debe ser el nombre real y pide confirmar antes de guardar

#### Scenario: Sin edad
- **WHEN** la historia no tiene edad registrada
- **THEN** se trata como adulta, la edad se imprime vacía y no hay error

### Requirement: Migración de las historias existentes al alias
Las historias existentes SHALL pasar al formato con alias mediante una acción administrativa única, que no es una operación de la API: el alias es la primera palabra del nombre guardado que no sea una partícula, la edad se calcula una vez y solo entonces se borran las columnas retiradas y los nombres del paciente y apoderado en las firmas. La acción NO SHALL ejecutarse sin copia verificada ni aprobación escrita, y cada historia SHALL quedar marcada como migrada.

#### Scenario: Migración correcta
- **WHEN** la acción se ejecuta con aprobación y copia verificada sobre una historia con nombre "Ana Quispe" y nacimiento 2012-05-20 e inicio 2026-05-19
- **THEN** la historia queda con alias "Ana" y edad 13, y se borran nombre completo, documento, nacimiento, lugar, domicilio, celular, texto de búsqueda y nombres de firma

#### Scenario: Historia sin fecha de nacimiento
- **WHEN** la historia no tiene fecha de nacimiento
- **THEN** su edad queda vacía y el resto de la migración se aplica igual

#### Scenario: Nombre vacío, de una palabra o con partículas
- **WHEN** el nombre guardado es nulo, vacío, solo espacios, "Ana" o "de la Cruz Rojas"
- **THEN** los alias resultan "Paciente", "Paciente", "Paciente", "Ana" y "Cruz", y ninguna historia queda sin alias

#### Scenario: Reejecución e interrupción
- **WHEN** la acción se interrumpe a la mitad y se ejecuta de nuevo, incluso con historias que quedaron sin edad por no tener fecha de nacimiento
- **THEN** las historias ya marcadas como migradas se omiten, las demás se procesan en su propia transacción y el resultado final es el mismo que sin interrupción

#### Scenario: Nombres de firma del paciente y del apoderado
- **WHEN** el contenido tiene `patientSignatureName`, `guardianName`, `guardianRelationship`, `supervisor1Name`, `supervisor2Name` y `treatingSignatureName`
- **THEN** la migración borra solo los tres primeros y conserva los nombres de supervisores y tratante, también en las versiones antiguas del contenido

#### Scenario: Historia migrada con datos clínicos inconsistentes
- **WHEN** la edad calculada es 7 y la historia ya tiene la primera menstruación a los 8 años
- **THEN** la migración conserva ambos valores y la cuenta como inconsistente en su informe, y el siguiente guardado de esa historia responde `400` con el error en el campo de la menarquia hasta que el tratante lo corrija

#### Scenario: Motivos de desbloqueo anteriores
- **WHEN** hay solicitudes pendientes y eventos con motivos en texto libre
- **THEN** la migración los reemplaza por `OTRO` y la solicitud sigue pendiente y los eventos conservan su fecha y acción

#### Scenario: Sin copia verificada o sin aprobación
- **WHEN** la acción se intenta sin copia verificada o sin la confirmación del responsable
- **THEN** no modifica ni borra nada

#### Scenario: Verificación posterior
- **WHEN** termina la acción
- **THEN** informa solo conteos y comprueba que no queda ninguna historia con columnas retiradas con valor, y si queda alguna aborta sin retirar las columnas

#### Scenario: Retiro del esquema
- **WHEN** no queda ninguna historia con datos en las columnas retiradas
- **THEN** una migración elimina esas columnas y el esquema resultante no contiene identificadores del paciente

#### Scenario: Retiro con historias pendientes
- **WHEN** queda al menos una historia con datos en esas columnas
- **THEN** la migración aborta con un error que no incluye ningún valor y no cambia el esquema

## MODIFIED Requirements

### Requirement: Crear una historia clínica de ortodoncia
El sistema SHALL permitir a cualquier usuario autenticado (`USER` o `ADMIN`) crear una historia clínica de ortodoncia indicando como mínimo el alias del paciente y el número de historia que asignan los docentes. La historia SHALL quedar asociada a su autor, y el odontólogo tratante SHALL proponerse con el nombre completo del autor (editable).

#### Scenario: Creación con el mínimo de datos
- **WHEN** un usuario autenticado crea una historia con el alias "Ana" y el número "AEO-0015"
- **THEN** el sistema guarda la historia, responde `201` con su identificador y número, y la abre en el primer paso del formulario
- **AND** el autor de la historia es ese usuario y el odontólogo tratante propuesto es su nombre completo

#### Scenario: Falta el nombre del paciente
- **WHEN** un usuario intenta crear una historia sin alias de paciente (vacío o solo espacios)
- **THEN** el sistema responde `400` con el error en el campo del alias y no crea la historia
- **AND** el formulario muestra el mensaje junto al campo

#### Scenario: Sin sesión
- **WHEN** una petición sin sesión válida intenta crear una historia
- **THEN** el sistema responde `401` y no crea nada


### Requirement: Listado y búsqueda de historias
El sistema SHALL ofrecer la sección "Historias clínicas" con un listado paginado, ordenado por última modificación (más reciente primero), con número, alias del paciente, odontólogo tratante, fecha de inicio y última modificación. SHALL permitir buscar por alias o número de historia, sin distinguir mayúsculas ni tildes. Un `USER` SHALL ver solo sus historias; un `ADMIN`, todas, con una columna de autor.

#### Scenario: USER ve solo las suyas
- **WHEN** un `USER` abre "Historias clínicas" y existen historias suyas y de otros
- **THEN** el listado muestra solo las suyas

#### Scenario: ADMIN ve todas con su autor
- **WHEN** un `ADMIN` abre "Historias clínicas"
- **THEN** el listado muestra las historias de todos los usuarios con la columna "Autor"

#### Scenario: Búsqueda sin tildes ni mayúsculas
- **WHEN** el usuario busca "mateo" y existe el paciente con alias "MATEO"
- **THEN** la historia aparece en el resultado

#### Scenario: Búsqueda por documento o número
- **WHEN** el usuario busca un número de historia existente (p. ej. "aeo-0015")
- **THEN** el resultado incluye la historia correspondiente

#### Scenario: Búsqueda por el número corregido
- **WHEN** el número de una historia se corrige de "AEO-0015" a "AEO-0051"
- **THEN** buscar "aeo-0051" la encuentra y buscar "aeo-0015" ya no

#### Scenario: Búsqueda y página en la dirección
- **WHEN** el usuario busca "mateo" y pasa a la página 2 del listado
- **THEN** la dirección queda `/historias?q=mateo&pagina=2` y recargar o volver de otra pantalla conserva la búsqueda y la página

#### Scenario: Sin resultados
- **WHEN** la búsqueda no coincide con ninguna historia
- **THEN** el listado muestra un estado vacío "No hay historias que coincidan" con opción de limpiar la búsqueda

#### Scenario: Sin historias todavía
- **WHEN** el usuario no tiene ninguna historia
- **THEN** el listado muestra un estado vacío con el botón "Nueva historia"


### Requirement: Datos en la hoja impresa
Los datos escritos SHALL imprimirse como texto, sin las líneas del PDF; los campos de opciones SHALL listar todas las opciones con la elegida marcada; un texto vacío NO SHALL imprimir líneas en blanco. Solo la fecha, las firmas y la hoja 1 SHALL llevar línea: alias, edad, sexo y fecha de inicio con su dato, y nombre completo, documento, nacimiento, domicilio y celular en blanco para escribirlos a mano.

#### Scenario: Opciones de una pregunta en la hoja impresa
- **WHEN** una pregunta termina en ":" (p. ej. "3. PROPORCIÓN DE LOS TERCIOS FACIALES:")
- **THEN** sus opciones se imprimen en el renglón siguiente, juntas si caben en un renglón ("☐ Presenta ☒ No presenta")
- **AND** si no caben (p. ej. "5. RELACIÓN ANTEROPOSTERIOR DE LABIOS:"), una opción por renglón, sin partir la lista a la mitad

#### Scenario: Textos de la anamnesis sin respuesta
- **WHEN** se imprime una historia con algún texto de la anamnesis vacío (queja principal, gustos, historia médica, accidentes, estructura familiar, tratamiento general o herencia)
- **THEN** ese texto se imprime como "No refiere" en lugar de renglones en blanco
- **AND** en el formulario esos campos muestran "No refiere" como ayuda mientras están vacíos

#### Scenario: Opciones marcadas
- **WHEN** se imprime una historia con Tipo facial "Mesofacial"
- **THEN** la línea muestra "☒ Mesofacial ☐ Dolicofacial ☐ Braquifacial"

#### Scenario: Datos escritos sin líneas de llenado a mano
- **WHEN** se imprime una historia con diagnóstico general y lista de problemas escritos
- **THEN** esos datos salen como texto sin subrayado ni renglones debajo
- **AND** conservan su línea solo "FECHA:", las líneas "Firma" y la hoja 1 (ALIAS, Edad, Sexo y Fecha de inicio con su dato; Nombre y apellidos, Documento, Lugar y fecha de nacimiento, Domicilio y Celular en blanco)

#### Scenario: Textos largos
- **WHEN** un campo de texto libre ocupa más de lo que el PDF reserva
- **THEN** el texto se imprime completo continuando en la página siguiente, sin cortarse ni solaparse


#### Scenario: Datos del paciente a mano
- **WHEN** se imprime la hoja 1 de una historia con alias "Mateo", sexo masculino y edad 13
- **THEN** la hoja muestra el alias, el sexo y la edad, y deja líneas en blanco para el nombre completo, el documento, el lugar y fecha de nacimiento, el domicilio y el celular
- **AND** el servidor no guarda ningún valor para esas líneas (`add-orthodontic-records-local-patient-notebook` puede completarlas desde el navegador)

### Requirement: Datos del paciente fijos tras imprimir
La primera impresión registrada de una historia, completa o no, SHALL fijar los datos del paciente: alias, sexo y edad. Desde entonces, un guardado que los cambie SHALL rechazarse con `409` (`/errors/patient-locked`) y el mensaje "Los datos del paciente quedaron fijos al imprimir la historia. Solicita el desbloqueo para corregirlos.", sin guardar nada. La regla SHALL aplicarse igual a historias de autor `ADMIN`.

#### Scenario: Corregir antes de imprimir
- **WHEN** el tratante cambia el alias del paciente de una historia que nunca se imprimió
- **THEN** se guarda normalmente

#### Scenario: Primera impresión fija los datos
- **WHEN** el tratante imprime una historia por primera vez
- **THEN** alias, sexo y edad quedan fijos y el formulario los muestra de solo lectura con el aviso

#### Scenario: Imprimir un avance también fija
- **WHEN** el tratante imprime el avance de una historia con 3 de 7 pasos clínicos con datos
- **THEN** los datos quedan fijos y puede seguir llenando los demás pasos y reimprimir

#### Scenario: Cambiar un dato fijo
- **WHEN** se intenta guardar otro alias, sexo o edad en una historia ya impresa
- **THEN** la API responde `409` con el mensaje de datos fijos y la historia queda exactamente como estaba

#### Scenario: Guardado de otra pestaña después de imprimir
- **WHEN** otra pestaña, abierta antes de la primera impresión, guarda un cambio en el alias del paciente
- **THEN** la API responde `409` de datos fijos y no guarda nada

#### Scenario: Impresión y guardado simultáneos
- **WHEN** se imprime una historia al mismo tiempo que se guarda con otro alias de paciente
- **THEN** o el guardado entra antes y se imprime y fija ese alias, o la impresión fija el alias anterior y el guardado recibe `409`; nunca queda fijo un alias distinto del impreso

#### Scenario: Historia de autor ADMIN
- **WHEN** un `ADMIN` imprime una historia propia y luego intenta cambiar el alias
- **THEN** recibe el mismo `409` de datos fijos

#### Scenario: Historias impresas antes de este cambio
- **WHEN** se abre una historia impresa antes de este cambio
- **THEN** sus datos están desbloqueados hasta la próxima impresión registrada


### Requirement: Comparación de los datos fijos
La comparación de los datos fijos SHALL hacerse en forma canónica (sin distinguir mayúsculas, tildes, formas Unicode equivalentes ni espacios sobrantes): un cambio que solo corrige la escritura SHALL guardarse. La fecha de inicio de tratamiento y el contenido clínico SHALL seguir editables y la historia reimprimible.

#### Scenario: Corregir solo la escritura
- **WHEN** en una historia fijada se guarda "MATEO " o "mateo" donde decía "Mateo"
- **THEN** se guarda (es la misma identidad)

#### Scenario: Datos que sí cambian
- **WHEN** el tratante cambia la fecha de inicio o el contenido clínico de una historia ya impresa, guarda y reimprime
- **THEN** todo se guarda y se imprime normalmente


### Requirement: Paso 1 siempre con datos e historias sin calcular
Como el alias del paciente es obligatorio, el servidor SHALL incluir siempre el paso 1 en lo que guarda, también al crear sin el dato o con una lista vacía. Una historia nunca guardada con este dato SHALL quedar "sin calcular".

#### Scenario: Crear una historia
- **WHEN** el usuario crea una historia con el alias del paciente, se envíe o no `filledSteps` (o se envíe vacío)
- **THEN** la historia nace con el paso 1 con datos, no "sin calcular"

#### Scenario: Historia anterior a este cambio
- **WHEN** se consulta una historia que no se volvió a guardar desde este cambio
- **THEN** sus pasos con datos figuran como sin calcular


### Requirement: Uso en celular y tablet
El módulo de historia clínica (listado, formulario de 8 pasos y vista previa) SHALL poder usarse desde 375 px de ancho sin desplazamiento horizontal de la página. Las acciones de cada historia y del formulario SHALL quedar visibles sin desplazarse de lado. Las tablas que no caben en el ancho SHALL desplazarse dentro de su propia caja, con un indicador visual de que hay más contenido. La hoja impresa SHALL NOT cambiar.

#### Scenario: Sin desplazamiento horizontal de página
- **WHEN** el usuario abre el listado, cualquiera de los 8 pasos (con todos los paneles del paso 5 abiertos) o la vista previa en una pantalla de 375 px o de 768 px de ancho
- **THEN** la página no se desplaza horizontalmente

#### Scenario: Listado en tarjetas
- **WHEN** el usuario abre el listado en una pantalla de menos de 1024 px de ancho
- **THEN** cada historia aparece como una tarjeta con número, alias del paciente, tratante, inicio y fecha de modificación
- **AND** los botones "Editar" y "Vista previa" de cada historia están visibles sin desplazarse

#### Scenario: Listado en tabla en escritorio
- **WHEN** el usuario abre el listado en una pantalla de 1024 px o más
- **THEN** las historias aparecen en la tabla, como hasta ahora

#### Scenario: Paso actual visible
- **WHEN** el usuario abre un paso en una pantalla de celular
- **THEN** el encabezado muestra "Paso N de 8" con su título y el botón "Pasos" para abrir la lista

#### Scenario: Vista previa escalada
- **WHEN** el usuario abre la vista previa en una pantalla más angosta que una hoja A4
- **THEN** las hojas se reducen para caber en el ancho y el botón "Imprimir" queda visible
- **AND** al imprimir, las hojas salen en tamaño A4 real, iguales que antes

#### Scenario: Tablas anchas del paso 5
- **WHEN** una grilla de piezas (Nance o Bolton) o una tabla de espacios no cabe en el ancho
- **THEN** se desplaza dentro de su caja con la columna de etiquetas fija, y un degradado en el borde indica que hay más contenido hasta llegar al final

#### Scenario: Puntos 1 y 2 de Nance en celular
- **WHEN** el usuario abre el análisis de Nance en una pantalla de celular
- **THEN** cada punto (SA y ST) se muestra como un bloque con su etiqueta completa y los campos "Superior" e "Inferior" visibles, sin columnas cortadas

#### Scenario: Barra de acciones compacta
- **WHEN** el usuario está en un paso del formulario en una pantalla de celular
- **THEN** "Anterior", "Guardar" y "Siguiente" caben en una sola fila, y "Anterior" y "Siguiente" conservan su nombre para el lector de pantalla


### Requirement: Secciones clínicas de la fase 1
El formulario SHALL cubrir los campos de las págs. 1–4 y 10–13 del PDF. Donde el PDF ofrece opciones sobre líneas, SHALL usar selección única, salvo en las listas que admiten más de una (hábitos de succión del análisis funcional), con selección múltiple; donde deja líneas para escribir, texto libre. Los campos condicionados SHALL mostrarse solo cuando aplican y descartarse al guardar si su condición deja de cumplirse. Los valores numéricos SHALL respetar su unidad y rango.

#### Scenario: Selección única
- **WHEN** el usuario marca "Dolicofacial" en Tipo facial y luego "Braquifacial"
- **THEN** queda seleccionado solo "Braquifacial"

#### Scenario: Selección múltiple
- **WHEN** el usuario marca "Dedos" y "Onicofagia" en Hábitos de succión (análisis funcional)
- **THEN** ambos quedan guardados y la opción "No" se desmarca

#### Scenario: Hábitos de succión con "No" por defecto
- **WHEN** el usuario abre el análisis funcional de una historia nueva, o en la anamnesis respondió "No" a Hábitos de succión
- **THEN** la lista de hábitos muestra "No" marcado; con "No" en la anamnesis no se pueden marcar hábitos
- **AND** marcar "No" desmarca cualquier hábito marcado

#### Scenario: Interposición lingual lateral con lado
- **WHEN** el usuario elige Actividad lingual "Interp. lateral"
- **THEN** aparece el lado (derecho, izquierdo o ambos) y se imprime junto a la opción
- **AND** si cambia a "Normal" o "Interp. anterior", el lado se descarta al guardar

#### Scenario: Piezas con desgaste en selector FDI
- **WHEN** el usuario elige bruxismo "Sí, con presencia de desgastes" y marca las piezas 26, 13 y 55 en el selector
- **THEN** se guardan solo códigos FDI válidos (permanentes 11–48, temporales 51–85) y se imprimen ordenados: "13, 26, 55"
- **AND** un código fuera de esos rangos responde `400`

#### Scenario: Selección con imagen de la guía facial
- **WHEN** el usuario está en el paso de Análisis facial
- **THEN** las preguntas con ilustración en la Guía de análisis facial muestran cada opción con su imagen (o la imagen de referencia junto a las opciones) y el valor normativo de la guía como ayuda
- **AND** pulsar la imagen de una opción la selecciona igual que pulsar su etiqueta

#### Scenario: Tercios y simetrías con observaciones
- **WHEN** el usuario marca "No presenta" en Proporción de los tercios faciales y escribe "Tercio inferior aumentado"
- **THEN** se guardan la opción y el texto; la impresión muestra "☐ Presenta" y "☒ No presenta" en renglones separados y el texto debajo
- **AND** Simetría facial en reposo y en apertura bucal funcionan igual (presenta / no presenta + texto)

#### Scenario: Historias guardadas con el formato anterior del análisis facial
- **WHEN** una historia guardada antes del cambio tenía "No presenta, tercio aumentado" con los tercios superior e inferior, o un lado asimétrico marcado
- **THEN** al actualizar el sistema queda "No presenta" con el texto "Tercio aumentado: superior, inferior" (o "Lado asimétrico: izquierdo"), sin perder información

#### Scenario: AFAI aumentada y disminuida son excluyentes
- **WHEN** el usuario elige Patrón II, marca "Con aumento de AFAI" y luego "Con AFAI disminuida"
- **THEN** queda marcada solo "Con AFAI disminuida"; "Retrusión mandibular" y "Protrusión maxilar" sí pueden marcarse juntas
- **AND** al cambiar a otro patrón, las características del Patrón II se descartan al guardar

#### Scenario: Análisis facial en una sola hoja
- **WHEN** se imprime una historia con el análisis facial completo
- **THEN** la sección ocupa una sola hoja A4, en blanco y negro, con casillas y sin las imágenes de la guía

#### Scenario: Higiene oral por categorías
- **WHEN** el usuario selecciona "Regular" en Higiene oral
- **THEN** queda seleccionada solo una de "Excelente", "Buena", "Regular" y "Deficiente", se guarda y se imprimen las cuatro opciones con "Regular" marcada
- **AND** sin selección la historia se guarda igual (es un borrador) sin asignar una categoría por defecto

#### Scenario: Hábitos de succión Sí/No en la anamnesis
- **WHEN** el usuario responde "No" en Hábitos de succión de la anamnesis
- **THEN** se guarda como selección única y se imprime "☐ Sí ☒ No"

#### Scenario: Pregunta solo para niñas
- **WHEN** el sexo del paciente es masculino o no está indicado
- **THEN** la pregunta "¿La 1ª menstruación ya ocurrió?" y su edad no se muestran ni se imprimen
- **AND** si tenían valor y el sexo cambia a masculino o se quita, ambos se descartan al guardar

#### Scenario: Fecha de la primera menstruación
- **WHEN** el sexo es femenino, el usuario responde "Sí" y registra que ocurrió a los 13 años
- **THEN** se guardan la respuesta y la edad (años enteros) y se imprimen
- **AND** si la respuesta cambia a "No", la edad se oculta y se descarta al guardar

#### Scenario: Fecha de la primera menstruación inválida
- **WHEN** la edad de la primera menstruación no es un entero entre 8 y 18 años, o supera la edad registrada de la paciente
- **THEN** el sistema responde `400` con el error en ese campo y no guarda la historia
- **AND** el formulario muestra el mensaje junto al campo; sin edad registrada solo se exige el rango de 8 a 18

#### Scenario: Paciente menor de la edad mínima
- **WHEN** la edad registrada de la paciente es menor de 8 años
- **THEN** la opción "Sí" de "¿La 1ª menstruación ya ocurrió?" está deshabilitada, con un aviso que explica que antes de los 8 años no aplica; "No" se puede marcar
- **AND** si ya estaba marcado "Sí", el formulario muestra el error junto a la pregunta y el servidor responde `400` con el error en ese campo sin guardar la historia

#### Scenario: Historias con la fecha completa de la primera menstruación
- **WHEN** una historia guardada antes de este cambio tenía el año de la primera menstruación 2023 y la fecha de nacimiento 20/05/2010
- **THEN** pasa a registrar la edad 13 (año de la menstruación − año de nacimiento) y deja de guardar el año
- **AND** si no tenía fecha de nacimiento, o el cálculo no da una edad positiva, el dato queda vacío y la respuesta "Sí" se conserva

#### Scenario: Campos condicionados por la opción elegida
- **WHEN** el usuario elige "Mordida cruzada posterior unilateral" o "Sí, con presencia de desgastes" (bruxismo)
- **THEN** aparece el lado o el selector de piezas, respectivamente
- **AND** si después cambia a otra opción, ese dato se descarta al guardar

#### Scenario: Valores numéricos con unidad y rango
- **WHEN** el usuario indica mordida profunda 40 (%), mordida abierta 3 (mm) y overjet 5 (mm)
- **THEN** se guardan con su unidad
- **AND** un porcentaje fuera de 0–100 o milímetros fuera de 0–30 responde `400` con el error en ese campo

#### Scenario: Curva de Spee alterada con texto
- **WHEN** el usuario elige Curva de Spee "Alterada"
- **THEN** aparece un texto libre para describirla; con "Normal" no se pide texto y el que hubiera se descarta al guardar

#### Scenario: Anteroposterior normal excluye overjet y mordida cruzada anterior
- **WHEN** el usuario marca Anteroposterior "Normal" teniendo overjet o piezas de mordida cruzada anterior cargados
- **THEN** esos campos se ocultan y se descartan al guardar

#### Scenario: Línea media estructurada
- **WHEN** el usuario indica línea media inferior "desviada a la izquierda" 2 mm y superior "centrada"
- **THEN** se guarda e imprime "superior centrada · inferior desviada a la izquierda 2 mm"
- **AND** una desviación menor a 0,5 mm o sin valor responde `400` con el error en ese campo

#### Scenario: Relación de caninos y molares con clase y detalle
- **WHEN** el usuario marca caninos lado derecho "Clase II" con detalle "½ cúspide"
- **THEN** se imprime "Clase II ½ cúspide" en la columna del lado derecho

#### Scenario: Relación de caninos en RC según MI y MIH
- **WHEN** el usuario marca "MI ≠ RC" (máxima intercuspidación) y no "MIH ≠ RC" (mordida habitual)
- **THEN** se pide e imprime solo la relación de caninos en RC correspondiente a MI; la de MIH no aparece y su dato se descarta al guardar

#### Scenario: Análisis cefalométricos realizados
- **WHEN** el usuario marca Steiner, Ricketts y Jarabak en Diagnóstico cefalométrico del análisis radiográfico
- **THEN** se guardan los tres, el formulario indica "3 de 3" y la impresión lista las seis opciones (Steiner, Ricketts, McNamara, Wits, Tweed y Jarabak) con las elegidas marcadas
- **AND** con menos de 3 marcados la historia se guarda igual (es un borrador) y el formulario muestra "n de 3"

#### Scenario: Más de tres análisis cefalométricos
- **WHEN** el usuario marca cinco de los seis análisis
- **THEN** se guardan los cinco, el formulario indica que alcanzó el mínimo ("3 de 3") y la impresión los marca a todos

#### Scenario: Lista de problemas y metas ítem por ítem
- **WHEN** el usuario agrega los problemas "Overjet aumentado" y "Mordida profunda" y luego sube el segundo al primer lugar
- **THEN** se guardan en ese orden y se imprimen numerados "1. Mordida profunda" y "2. Overjet aumentado"
- **AND** un ítem vacío no se guarda; más de 30 ítems o un ítem de más de 500 caracteres responde `400`

#### Scenario: Dos planes de tratamiento
- **WHEN** el usuario escribe el Plan 1 y deja vacío el Plan 2
- **THEN** se imprimen ambos títulos: el Plan 1 con su texto y el Plan 2 sin texto ni líneas

#### Scenario: Apoderado firma por el paciente menor de edad
- **WHEN** la edad registrada del paciente es menor de 18 años
- **THEN** el paso de firmas no pide nombres y la impresión muestra "FIRMA DEL APODERADO" con líneas en blanco para su nombre y parentesco, y la línea de firma
- **AND** con 18 años o más, o sin edad registrada, imprime "FIRMA DEL PACIENTE" con línea en blanco para su nombre; el sistema no guarda nombres de paciente ni de apoderado

#### Scenario: Fecha y supervisores a mano
- **WHEN** se imprime la página de firmas
- **THEN** "FECHA:" sale con su línea vacía para llenarla a mano y los nombres de supervisores salen como se escribieron (o en blanco, sin línea), cada uno con su línea de firma

#### Scenario: Deseleccionar una opción
- **WHEN** el usuario quita la selección de un campo de selección única
- **THEN** el campo queda vacío y se imprime con todas sus opciones sin marcar


### Requirement: Solicitud de desbloqueo
Con los datos fijos, el autor SHALL poder pedir el desbloqueo con un motivo de un catálogo cerrado (`ALIAS`, `SEXO`, `EDAD`, `OTRO`), sin texto libre; si está pendiente, la historia SHALL mostrar "Desbloqueo solicitado el dd/mm/aaaa" y no admitir otra. El `ADMIN` SHALL desbloquearla o descartarla. Sin datos fijos SHALL responder `409` (`/errors/patient-not-locked`); con una pendiente, `409` (`/errors/unlock-already-requested`); en historia ajena, `404`; si un `USER` descarta, `403`.

#### Scenario: Solicitar el desbloqueo
- **WHEN** el tratante solicita el desbloqueo de su historia fijada con el motivo `EDAD`
- **THEN** la historia muestra "Desbloqueo solicitado el <fecha>" y el ADMIN ve la solicitud con el motivo "Edad"

#### Scenario: Solicitud repetida
- **WHEN** el tratante intenta solicitar otra vez con una solicitud pendiente
- **THEN** la acción no está disponible y la API responde `409`

#### Scenario: Solicitudes simultáneas
- **WHEN** llegan dos solicitudes de la misma historia al mismo tiempo
- **THEN** se guarda una y la otra recibe `409`

#### Scenario: El ADMIN desbloquea con solicitud
- **WHEN** el `ADMIN` desbloquea una historia con solicitud pendiente
- **THEN** los datos se desbloquean, la solicitud desaparece y el evento guarda su motivo

#### Scenario: El ADMIN descarta
- **WHEN** el `ADMIN` descarta una solicitud
- **THEN** los datos siguen fijos, la solicitud desaparece, se registra el evento y el tratante puede volver a solicitar

#### Scenario: Solicitar sin datos fijos
- **WHEN** se solicita el desbloqueo de una historia que nunca se imprimió
- **THEN** la API responde `409`

#### Scenario: USER intenta descartar
- **WHEN** un `USER` intenta descartar una solicitud

#### Scenario: Motivo fuera del catálogo
- **WHEN** un cliente envía una solicitud con un motivo que no está en el catálogo o con texto libre
- **THEN** la API responde `400` y no guarda nada

#### Scenario: Solicitudes y eventos sin texto libre
- **WHEN** se inspeccionan las solicitudes pendientes y los eventos de desbloqueo
- **THEN** el motivo guardado es solo un valor del catálogo y ninguno contiene texto escrito por el usuario

### Requirement: Análisis de Moyers
El sistema SHALL registrar la ficha del análisis de Moyers de la pág. 6 del PDF en el paso "Análisis de modelos": fecha del análisis, ancho mesiodistal de 42, 41, 31 y 32, espacio disponible de mandíbula y maxilar por lado (derecho e izquierdo), predisposición de apiñamiento dental (un texto por fila: Positivo, Nulo y Negativo, escrito por el odontólogo, que SHALL NOT calcularse) e interpretación. Nombre y edad SHALL tomarse de la historia.

#### Scenario: Predisposición de apiñamiento escrita por el odontólogo
- **WHEN** el odontólogo escribe en la fila Negativo "Mandíbula derecho" y deja vacías Positivo y Nulo
- **THEN** se guarda e imprime tal cual en la Tabla 2, sin completarse a partir de las diferencias

#### Scenario: Historias guardadas antes del cambio
- **WHEN** se abre una historia guardada antes de existir el análisis de Moyers
- **THEN** el bloque aparece vacío y la historia se guarda sin errores

#### Scenario: Hoja impresa de Moyers
- **WHEN** se imprime una historia
- **THEN** después de la hoja del análisis transversal sale "FICHA PARA EL ANÁLISIS DE MOYERS" con alias, edad y fecha, la ficha con incisivos, suma, disponible, requerido y diferencia, la tabla de predisposición de apiñamiento con lo escrito y la interpretación


### Requirement: Análisis de Nance
El sistema SHALL registrar la ficha del análisis de Nance & Carey (discrepancia óseo dentaria) de la pág. 7 del PDF en el paso "Análisis de modelos": fecha del análisis, espacio disponible (SA) superior e inferior, ancho mesiodistal de las piezas 15 a 25 y 45 a 35, conclusión superior e inferior (escritas por el odontólogo, que SHALL NOT calcularse) e interpretación. Nombre y edad SHALL tomarse de la historia.

#### Scenario: Conclusión escrita por el odontólogo
- **WHEN** el odontólogo escribe la conclusión superior "Falta de espacio leve" y deja vacía la inferior
- **THEN** se guarda e imprime tal cual, sin completarse a partir de la discrepancia

#### Scenario: Historias guardadas antes del cambio
- **WHEN** se abre una historia guardada antes de existir el análisis de Nance
- **THEN** el panel aparece vacío y la historia se guarda sin errores

#### Scenario: Hoja impresa de Nance
- **WHEN** se imprime una historia
- **THEN** después de la hoja de la fórmula de Tanaka-Johnston (que sigue a la de Moyers) sale "ANÁLISIS DE NANCE · DISCREPANCIA ÓSEO DENTARIA" con alias, edad y fecha, SA y ST por arcada, el dibujo de la arcada, los anchos de cada pieza con su total, la tabla con discrepancia y conclusión, y la interpretación
- **AND** la pág. 8 del PDF (en blanco) no se imprime


### Requirement: Hojas impresas de Tanaka-Johnston y Wolford
La impresión SHALL incluir cada análisis en su propia hoja, con alias y edad: "FÓRMULA DE TANAKA-JOHNSTON" tras la hoja de Moyers (suma, espacios maxilar y mandibular con su fórmula e interpretación) y "ANÁLISIS DE WOLFORD" tras la de Bolton (cuatro sumas, discrepancias total y parcial con su fórmula e interpretación), con el valor usado, sugerido o escrito. Sin una suma, la fila y su fórmula SHALL imprimirse con el resultado "—".

#### Scenario: Hoja de Tanaka-Johnston
- **WHEN** se imprime una historia
- **THEN** después de la hoja de Moyers sale "FÓRMULA DE TANAKA-JOHNSTON" con "MAX (suma ÷ 2) + 11 = …" y "MAND (suma ÷ 2) + 10,5 = …" y la interpretación

#### Scenario: Hoja de Wolford
- **WHEN** se imprime una historia
- **THEN** después de la hoja de Bolton sale "ANÁLISIS DE WOLFORD" con la discrepancia total y la parcial, sus fórmulas y la interpretación

#### Scenario: Grilla de anchos en la hoja de Wolford
- **WHEN** se imprime una historia
- **THEN** la hoja de Wolford incluye la grilla "Ancho mesiodistal de las 12 piezas" con los números de pieza 16 a 26 y 46 a 36 y los anchos registrados en Bolton y Nance (casilla vacía si falta el ancho), sin pedirlos de nuevo en el formulario

#### Scenario: Hoja con una suma vacía
- **WHEN** se imprime una historia sin la suma de 6 mandibulares
- **THEN** la fila de la discrepancia parcial sale con su fórmula, la suma de 6 maxilares y el resultado "—", sin signo

#### Scenario: Dos hojas más
- **WHEN** se imprime la misma historia antes y después de este cambio
- **THEN** la impresión tiene dos páginas más, en ese orden, y la marca "AVANCE · N de 7" mantiene el mismo N


## REMOVED Requirements

### Requirement: Datos del paciente con edad calculada
**Reason**: La historia ya no guarda documento, fecha de nacimiento, lugar de nacimiento, domicilio ni celular del paciente, y la edad deja de calcularse: se escribe.
**Migration**: "Paciente identificado por alias, sexo y edad" y "Migración de las historias existentes al alias".

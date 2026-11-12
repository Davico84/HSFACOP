# Spec Delta

## ADDED Requirements

### Requirement: Libreta local de datos del paciente
El navegador SHALL poder guardar, por cuenta y por historia, el nombre completo, el documento (tipo y número), la fecha y el lugar de nacimiento, el domicilio, el celular del paciente y el nombre y parentesco de quien firma, en una libreta local del dispositivo. Estos datos NO SHALL enviarse al servidor en ninguna petición, dirección, registro, evento ni archivo, y perderlos NO SHALL afectar a la historia del servidor.

#### Scenario: Guardar en la libreta
- **WHEN** el tratante escribe el nombre completo y el DNI "74125896" en el paso 1 de su historia y guarda
- **THEN** la libreta del dispositivo guarda esos datos ligados a su cuenta y a esa historia, y el servidor guarda solo el alias, el sexo y la edad

#### Scenario: Nada viaja al servidor
- **WHEN** el tratante guarda, imprime, busca o exporta con datos en su libreta
- **THEN** ninguna petición a la API ni a la dirección del documento contiene esos datos ni sus partes

#### Scenario: Documento con formato incorrecto
- **WHEN** el tratante escribe un DNI de 7 dígitos, un carné de extranjería con letras o un pasaporte de 5 dígitos
- **THEN** el formulario muestra el error junto al campo y no guarda esa entrada en la libreta

#### Scenario: Otra cuenta en el mismo dispositivo
- **WHEN** otra cuenta inicia sesión en el mismo navegador
- **THEN** no ve ni lista las entradas de la libreta de la primera cuenta

#### Scenario: Historia sin libreta
- **WHEN** el tratante abre una historia sin entrada en la libreta de ese dispositivo
- **THEN** el formulario funciona igual, con los campos de la libreta vacíos y un aviso de que esos datos viven solo en el dispositivo

#### Scenario: Entrada de otra historia con el mismo identificador
- **WHEN** la entrada guarda el número de historia "AEO-0015" y el servidor devuelve para ese identificador la historia "AEO-0031"
- **THEN** la aplicación no usa la entrada, avisa que no corresponde y no la imprime ni la muestra en esa historia

### Requirement: Libreta no disponible en el navegador
Si el navegador no ofrece IndexedDB o `crypto.subtle`, o una escritura falla (cuota, modo privado, actualización bloqueada), la aplicación SHALL decirlo con un mensaje visible, no dar por guardado ningún dato y no guardarlo en ningún otro lugar. Sin `crypto.subtle` SHALL deshabilitar exportar e importar.

#### Scenario: Sin IndexedDB o en modo privado
- **WHEN** el navegador no permite IndexedDB
- **THEN** los campos de la libreta se deshabilitan con el aviso "La libreta no está disponible en este navegador" y la historia sigue funcionando

#### Scenario: Escritura que falla
- **WHEN** guardar una entrada falla por cuota o por una actualización de la base bloqueada por otra pestaña
- **THEN** se muestra un error visible ("Cierra las otras pestañas y vuelve a intentar" en el segundo caso) y la entrada no figura como guardada

#### Scenario: Sin criptografía del navegador
- **WHEN** la página se abre sin `crypto.subtle` (por ejemplo, sin HTTPS)
- **THEN** exportar e importar quedan deshabilitados con un aviso, y no se genera ningún archivo sin cifrar

### Requirement: Hoja impresa con los datos de la libreta
Al imprimir, el navegador SHALL completar con la libreta, si hay entrada para esa historia, el nombre y apellidos, el documento, el lugar y la fecha de nacimiento, el domicilio y el celular de la hoja 1, y los nombres de la hoja de firmas; sin entrada SHALL dejar esas líneas en blanco. El título del documento y el nombre del archivo NO SHALL incluir datos del paciente.

#### Scenario: Imprimir con libreta
- **WHEN** el tratante imprime una historia que tiene entrada en la libreta
- **THEN** la hoja 1 muestra el nombre completo y los demás datos de la libreta junto al alias, el sexo y la edad

#### Scenario: Imprimir sin libreta
- **WHEN** el tratante imprime una historia sin entrada en la libreta
- **THEN** esas líneas salen en blanco para escribirlas a mano

#### Scenario: Título y archivo del PDF
- **WHEN** el tratante guarda la impresión como PDF desde el navegador
- **THEN** el nombre propuesto del archivo y el título del documento no contienen nombre, documento ni alias

#### Scenario: Registro de la impresión
- **WHEN** el sistema registra la impresión en el servidor
- **THEN** la petición lleva solo el identificador de la historia y la marca de avance, sin datos de la libreta

#### Scenario: Fallo de lectura de la libreta al imprimir
- **WHEN** la lectura de la libreta falla antes de imprimir
- **THEN** la aplicación muestra el error, no registra la impresión ni fija los datos, y ofrece imprimir con las líneas en blanco de forma explícita

#### Scenario: Entrada que cambia mientras se imprime
- **WHEN** la entrada se edita en otra pestaña después de que el usuario abrió la vista de impresión
- **THEN** la hoja usa una copia de la entrada tomada antes de registrar la impresión, y reimprimir toma una copia nueva

### Requirement: Exportación cifrada de la libreta
El usuario SHALL poder exportar su libreta a un archivo cifrado en el navegador con AES-GCM y una clave derivada con PBKDF2-SHA256 (600 000 iteraciones o más) de una frase generada de 6 palabras que se muestra una sola vez, con IV aleatorio de 96 bits y sal de 16 bytes nuevos en cada exportación. Los parámetros y la cuenta SHALL ser parte de lo autenticado. El nombre del archivo SHALL carecer de datos del paciente.

#### Scenario: Exportar
- **WHEN** el usuario exporta una libreta con 12 entradas
- **THEN** la aplicación muestra la frase una sola vez, pide confirmar que la guardó y descarga un archivo cifrado con nombre genérico y fecha

#### Scenario: Archivo ilegible sin la frase
- **WHEN** alguien abre el archivo exportado sin la frase
- **THEN** no encuentra nombres, documentos ni alias en su contenido

#### Scenario: Libreta vacía
- **WHEN** el usuario intenta exportar sin entradas
- **THEN** la aplicación indica que no hay nada que exportar y no genera archivo

#### Scenario: Exportaciones repetidas
- **WHEN** el usuario exporta 100 veces la misma libreta
- **THEN** no se repite ningún IV ni ninguna sal entre los archivos

#### Scenario: Parámetros alterados
- **WHEN** alguien cambia en el archivo la versión, el algoritmo, las iteraciones, la sal, el IV o la cuenta
- **THEN** la importación falla con el mismo mensaje genérico, porque esos valores están autenticados

### Requirement: Importación de la libreta
El usuario SHALL poder importar un archivo exportado con su frase: el navegador lo descifra, valida formato, versión y cuenta, y combina por historia según el número de revisión de cada entrada, sin enviar nada al servidor. Un archivo alterado, de otra cuenta, de versión desconocida, fuera de los límites (5 MiB, 5 000 entradas) o con frase incorrecta SHALL rechazarse con un único mensaje genérico, sin códigos distintos, y sin modificar la libreta.

#### Scenario: Importar en otro dispositivo
- **WHEN** el usuario importa en su celular el archivo exportado desde su PC
- **THEN** la libreta del celular queda con las entradas del archivo y se informa cuántas se agregaron

#### Scenario: Entradas en conflicto
- **WHEN** una historia tiene entrada en el dispositivo y en el archivo
- **THEN** gana la de mayor número de revisión; con la misma revisión y contenido distinto se conserva la del dispositivo y se cuenta como conflicto
- **AND** se informa cuántas se reemplazaron, cuántas se omitieron y cuántos conflictos hubo

#### Scenario: Reloj desajustado o fecha futura
- **WHEN** una entrada importada trae una fecha de modificación posterior a un día después de ahora
- **THEN** se rechaza el archivo con el mismo mensaje genérico, y el orden de las entradas nunca depende del reloj del dispositivo

#### Scenario: Archivo con demasiadas entradas o campos largos
- **WHEN** el archivo trae más de 5 000 entradas, un campo de más de 200 caracteres o un JSON de más de 5 niveles
- **THEN** se rechaza antes de abrir la transacción, con el mismo mensaje genérico y sin cambiar la libreta

#### Scenario: Frase incorrecta o archivo alterado
- **WHEN** la frase es incorrecta o el archivo fue modificado
- **THEN** la aplicación muestra "No se pudo abrir el archivo", sin distinguir la causa, y la libreta no cambia

#### Scenario: Archivo de otra cuenta, de versión futura o demasiado grande
- **WHEN** el archivo es de otra cuenta, trae una versión o un algoritmo desconocido, o pesa más de 5 MiB
- **THEN** se rechaza con el mismo mensaje genérico y la libreta no cambia

#### Scenario: Entradas de historias ajenas
- **WHEN** el archivo trae entradas de historias que no son del usuario
- **THEN** se omiten y se informa cuántas

### Requirement: Aviso de pérdida y recordatorio de respaldo
La aplicación SHALL avisar que la libreta vive solo en ese dispositivo, que el navegador puede borrarla y que el papel firmado es el registro oficial; SHALL pedir almacenamiento persistente cuando el navegador lo permita y SHALL recordar exportar cuando haya cambios sin exportar desde hace 7 días.

#### Scenario: Primer uso
- **WHEN** el usuario guarda por primera vez una entrada en la libreta
- **THEN** la aplicación muestra el aviso de que los datos viven solo en ese dispositivo y ofrece exportar

#### Scenario: Recordatorio
- **WHEN** pasan 7 días con cambios sin exportar
- **THEN** la aplicación muestra un recordatorio de exportar, que se puede posponer

#### Scenario: El navegador borró la libreta
- **WHEN** el usuario abre una historia que antes tenía entrada y la libreta ya no existe
- **THEN** los campos aparecen vacíos con el aviso de que puede importar un archivo exportado, y no se muestra un error de la historia

### Requirement: Equipo compartido y borrado de la libreta
El usuario SHALL poder borrar la libreta del dispositivo y marcar el equipo como compartido; en un equipo compartido la libreta SHALL borrarse al cerrar sesión y tras 15 minutos sin actividad, después de ofrecer exportarla. En un equipo no compartido el cierre de sesión la conserva.

#### Scenario: Borrar la libreta
- **WHEN** el usuario confirma "Borrar la libreta de este dispositivo"
- **THEN** se eliminan todas sus entradas del dispositivo y la historia del servidor no cambia

#### Scenario: Cierre de sesión en equipo compartido
- **WHEN** el usuario cierra sesión en un equipo marcado como compartido
- **THEN** la aplicación ofrece exportar y luego borra la libreta del dispositivo

#### Scenario: Inactividad en equipo compartido
- **WHEN** pasan 15 minutos sin actividad en un equipo compartido
- **THEN** la aplicación cierra la sesión y borra la libreta

#### Scenario: Borrado mientras otra pestaña exporta
- **WHEN** vence el plazo de inactividad mientras otra pestaña está exportando, importando o imprimiendo
- **THEN** el borrado espera a que esa operación termine, o la operación se cancela sin generar un archivo parcial, y nunca queda un archivo incompleto
- **AND** la actividad de cualquier pestaña reinicia el plazo en todas

### Requirement: Alias sugerido desde la libreta
Cuando el usuario escribe el nombre completo en la libreta, el formulario SHALL proponer como alias el nombre de pila más la inicial del primer apellido, sin partículas (por ejemplo "Ana Q"), calculado en el navegador y editable. El nombre NO SHALL enviarse: solo se envía el alias cuando el usuario guarda la historia.

#### Scenario: Propuesta de alias
- **WHEN** el usuario escribe "Ana Quispe Rojas" en el nombre de la libreta
- **THEN** el formulario propone el alias "Ana Q" y ninguna petición contiene el nombre

#### Scenario: Alias cambiado por el usuario
- **WHEN** el usuario reemplaza la propuesta por "Anita" y guarda
- **THEN** el servidor guarda "Anita" y la libreta conserva el nombre completo

#### Scenario: Nombre de una palabra o vacío
- **WHEN** el nombre tiene una sola palabra o está vacío
- **THEN** la propuesta es esa palabra, o no hay propuesta, y el alias lo escribe el usuario

### Requirement: Búsqueda local por nombre o documento
La búsqueda por nombre o documento SHALL resolverse solo en el dispositivo sobre la libreta, sin distinguir mayúsculas ni tildes, y mostrar las historias coincidentes; el texto buscado NO SHALL enviarse. El listado de las coincidencias SHALL pedirse al servidor por identificadores de historia, hasta 50.

#### Scenario: Buscar por nombre
- **WHEN** el usuario busca "quispe" y su libreta tiene a "Ana QUÍSPE" en la historia AEO-0015
- **THEN** el listado muestra esa historia y ninguna petición contiene el texto "quispe"

#### Scenario: Sin coincidencias o sin libreta
- **WHEN** la búsqueda no coincide con ninguna entrada o la libreta está vacía
- **THEN** el listado indica "No hay historias que coincidan en este dispositivo"

#### Scenario: Más de 50 coincidencias
- **WHEN** la búsqueda coincide con más de 50 historias
- **THEN** se muestran las 50 más recientes y se pide afinar la búsqueda

### Requirement: Copia de las historias existentes a la libreta
Hasta la fecha límite de copia, el servidor SHALL devolver al autor, y solo a él, los datos antiguos de su historia sin cachearlos ni registrarlos. El autor SHALL copiarlos a su libreta, exportar un archivo cifrado y verificar que descifra a lo copiado; solo entonces la historia SHALL marcarse como respaldada, con una marca sin datos del paciente.

#### Scenario: Copiar, exportar y verificar
- **WHEN** el autor copia una historia, exporta el archivo y la aplicación lo descifra en memoria y comprueba campo por campo que coincide
- **THEN** la historia queda marcada como respaldada y el servidor no recibe ningún dato

#### Scenario: Copia sin respaldo
- **WHEN** el autor copia una historia pero no exporta o la verificación del archivo falla
- **THEN** la historia no se marca como respaldada y se muestra el error con opción de reintentar

#### Scenario: Datos antiguos solo para el autor
- **WHEN** un `ADMIN`, un usuario de coordinación u otro `USER` pide los datos antiguos de una historia ajena
- **THEN** la API responde `404` y no devuelve ningún dato; la respuesta del autor lleva `Cache-Control: no-store` y no figura en los registros

#### Scenario: Fecha límite vencida
- **WHEN** pasa la fecha límite de copia o la historia ya se migró
- **THEN** la API deja de devolver los datos antiguos y la copia no está disponible

#### Scenario: Historias sin respaldar tras la fecha límite
- **WHEN** pasa la fecha límite de copia y una historia no tiene respaldo
- **THEN** la migración del alias borra sus datos antiguos igual y la historia sigue funcionando con los campos de la libreta vacíos

#### Scenario: Cambio de autor durante la copia
- **WHEN** la historia deja de ser del usuario mientras copia
- **THEN** la operación se cancela, no guarda nada en la libreta y la marca no se pone

#### Scenario: Historia ya migrada
- **WHEN** el servidor ya no conserva los datos de la historia
- **THEN** la copia no está disponible y la historia sigue funcionando con los campos de la libreta vacíos

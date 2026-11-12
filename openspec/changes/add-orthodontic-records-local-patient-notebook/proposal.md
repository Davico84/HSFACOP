## Why

`update-orthodontic-records-pseudonymous-patient` saca del servidor el nombre completo, el documento, el nacimiento, el domicilio y el celular del paciente, y la hoja impresa deja esas líneas en blanco para escribirlas a mano. Eso resuelve el riesgo del servidor, pero el tratante pierde dos cosas útiles: imprimir la hoja con el nombre real y buscar a un paciente por su nombre. Una **libreta local** devuelve ambas sin que el dato pase por el servidor: vive en el navegador de cada dispositivo, se une a la historia solo al imprimir y se puede exportar e importar en un archivo cifrado para respaldarla y pasarla de un dispositivo a otro. El papel firmado sigue siendo el registro oficial.

## What Changes

- Nueva **libreta local** por cuenta y por dispositivo (IndexedDB): nombre completo, tipo y número de documento, fecha y lugar de nacimiento, domicilio, celular, y nombre y parentesco de quien firma (paciente o apoderado). Opcional: sin libreta, todo funciona como en el change del alias.
- El servidor **nunca** recibe esos datos: ni en peticiones, direcciones, registros, eventos, nombre de archivo ni título del PDF.
- Al imprimir, el navegador completa la hoja 1 y la hoja de firmas con la libreta; sin entrada, deja las líneas en blanco.
- **Exportar** la libreta a un archivo cifrado en el navegador con una frase generada por la aplicación, e **importarla** en otro dispositivo, combinando por historia la entrada más reciente.
- Avisos: la libreta es del dispositivo, el navegador puede borrarla (por ejemplo Safari tras 7 días sin uso), el papel firmado es el registro oficial; recordatorio de exportar tras 7 días con cambios; petición de almacenamiento persistente.
- **Equipo compartido:** borrar la libreta, y modo que la borra al cerrar sesión y tras 15 minutos de inactividad.
- **Búsqueda por nombre o documento solo en el dispositivo**; el listado de coincidencias se pide por identificadores.
- **Copia de las historias existentes:** hasta una fecha límite fijada por el responsable, el servidor devuelve los datos antiguos solo al autor; el autor los copia a su libreta, exporta un archivo cifrado y la aplicación lo verifica antes de marcar la historia como respaldada. La migración del change del alias no borra sin ese respaldo, salvo decisión escrita.
- Entradas ligadas al número de historia, orden de importación por número de revisión (no por reloj), límites de importación, un único mensaje de error, coordinación entre pestañas y mensajes claros cuando el navegador no ofrece IndexedDB o `crypto.subtle`.

## Capabilities

### New Capabilities
- `patient-notebook`: libreta local de datos del paciente, su uso en la hoja impresa, exportación e importación cifradas, avisos de pérdida, equipo compartido, búsqueda local y copia de las historias existentes.

### Modified Capabilities
- Ninguna en este change. La hoja impresa de `orthodontic-records` pasa a mostrar los datos de la libreta cuando existen; esa modificación se redacta con `MODIFIED` al archivar, después de `update-orthodontic-records-pseudonymous-patient` (tarea 0.2).

## Impact

- Frontend: módulo de libreta (IndexedDB, Web Crypto), paso 1 con los campos "solo en este dispositivo", hoja impresa, listado/búsqueda, ajustes de la libreta, avisos.
- Backend: solo la marca de "historia copiada a la libreta" (sin datos) y su lectura por el autor; ninguna ruta recibe datos de la libreta.
- `docs/domain.md`, `docs/vision.md` y `docs/frontend.md`.
- **Dependencias y orden:** depende de `update-orthodontic-records-pseudonymous-patient` (se aplica después o en la misma entrega). Es independiente de `update-orthodontic-records-encrypt-patient-identity`, que sincroniza la identidad cifrada entre dispositivos por el servidor; si se aplicara ese change, la libreta puede quedar reducida a respaldo.

## Non-goals

- Sincronizar la libreta entre dispositivos por el servidor (lo hace el change de cifrado). Aquí el traslado es manual con el archivo.
- Cifrar la libreta en reposo dentro del navegador (se recomienda cifrado del disco del equipo; ver riesgos).
- Proteger contra un frontend comprometido o una extensión del navegador con acceso a la página.
- Recuperar una libreta perdida: sin archivo exportado no hay copia.
- Revisión legal bajo la Ley 29733: los datos guardados en el dispositivo del tratante siguen siendo datos personales de salud; se necesita igual (tarea 0.4).

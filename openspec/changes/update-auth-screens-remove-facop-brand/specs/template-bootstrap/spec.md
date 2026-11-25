## MODIFIED Requirements

### Requirement: Configuración única de la identidad visible
El repositorio SHALL declarar en `project.config.json` (raíz, validado por un JSON Schema versionado) nombre visible, tagline, descripción, base de datos (nombre, usuario, puerto, contenedor), JWT issuer, logos, favicon y colores de marca (claro y oscuro), y MUST NOT contener secretos. El frontend SHALL tomar de él esa identidad y el título de la pestaña; el backend SHALL exponer nombre y descripción en OpenAPI. Paquete Java y artefactos Maven/npm MUST NOT depender de él.

#### Scenario: La UI muestra la identidad configurada
- **WHEN** se renderizan las pantallas completas de login y de registro
- **THEN** muestran el tagline y la descripción de `project.config.json`; los subtítulos de login y de registro hablan de las historias clínicas ortodónticas; los logos usan las rutas configuradas con el nombre como texto alternativo; ninguna de las dos muestra la línea de derechos con el nombre

#### Scenario: Título de la pestaña desde la configuración
- **WHEN** se procesa el `index.html` del frontend (en desarrollo o en el build)
- **THEN** el `<title>` es el nombre de `project.config.json` y el favicon es la ruta configurada

#### Scenario: Configuración inválida
- **WHEN** `project.config.json` tiene un nombre vacío o demasiado largo, un nombre o usuario de base de datos con formato inválido, un nombre de contenedor que no esté en minúsculas, un puerto fuera de rango, un color fuera de la gramática admitida, una clave de color que no es un token de marca, o le falta un campo obligatorio
- **THEN** `project:apply` termina con un error que indica el campo, antes de cualquier otra comprobación, y no modifica ningún archivo

## Context

- `BrandPanel` (panel de escritorio) muestra el logo en blanco, el tagline, la descripción, el contacto y "© {project.name}". Lo usan `AuthLayout` (login, registro, restablecer) y `ServerWarmupScreen`.
- `AuthLayout` y `ServerWarmupScreen` además muestran el logo a color en móvil (`lg:hidden`).
- El logo de la barra lateral (`Sidebar`) y la hoja impresa usan sus propios elementos; no pasan por estas pantallas.
- `LoginFeature` y `RegisterFeature` arman su subtítulo con `project.name`.

## Goals / Non-Goals

**Goals:** que ninguna pantalla previa al ingreso muestre el logo de FACOP ni la línea de derechos (el logo pasa a ser el símbolo nuevo); subtítulo del login sobre historias clínicas ortodónticas.

**Non-Goals:** cambiar `project.config.json`, el nombre en la pestaña, la hoja impresa ni los colores del tema (el Roxo del tema no se retoca para igualar el morado del símbolo nuevo).

## Decisions

**1. Cambiar el logo por reemplazo de archivos, no del componente.** `BrandPanel`, `AuthLayout` y `ServerWarmupScreen` siguen usando `Logo`; lo que cambia son los archivos de marca (decisión 4). Alternativa descartada: quitar el logo de esas pantallas: se pidió reemplazarlo, no dejarlas sin marca.

**2. Panel de marca sin línea de derechos.** Sin el pie, el logo queda arriba y el contenido (tagline, descripción, contacto) centrado verticalmente en el panel Roxo.

**3. Subtítulos fijos en los componentes.** "Accede a tu panel de historias clínicas ortodónticas" (login) y "Regístrate para llevar tus historias clínicas ortodónticas" (registro) van como texto de `LoginFeature` y `RegisterFeature`; ya no dependen de `project.name`.

**4. Logo nuevo solo por reemplazo de archivos.** El símbolo nuevo (sin texto, cuadrado) sustituye a los cuatro archivos de marca sin tocar las rutas de `project.config.json`: `logo-light.svg` y `favicon.svg` en color sobre transparente; `logo-white.svg` y `logo-dark.svg` en blanco sobre transparente (modo oscuro y fondos de color).

## Risks / Trade-offs

- El nombre "HS FACOP" sigue en otros sitios (pestaña, barra lateral, textos de ayuda): el cambio se limita a lo pedido. Si se quiere desmarcar del todo, hace falta otro cambio.
- El símbolo nuevo es cuadrado y sin texto; el logo anterior era ancho. Hay que revisar a ojo la barra lateral y el panel.

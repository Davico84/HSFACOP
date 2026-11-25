## Context

- `BrandPanel` (panel de escritorio) muestra el logo en blanco, el tagline, la descripción, el contacto y "© {project.name}". Lo usan `AuthLayout` (login, registro, restablecer) y `ServerWarmupScreen`.
- `AuthLayout` y `ServerWarmupScreen` además muestran el logo a color en móvil (`lg:hidden`).
- El logo de la barra lateral (`Sidebar`) y la hoja impresa usan sus propios elementos; no pasan por estas pantallas.
- `LoginFeature` arma el subtítulo con `project.name`; `RegisterFeature` hace lo mismo.

## Goals / Non-Goals

**Goals:** que ninguna pantalla previa al ingreso muestre el logo ni la línea de derechos; subtítulo del login sobre historias clínicas ortodónticas.

**Non-Goals:** cambiar `project.config.json`, el nombre en la pestaña, el favicon, la barra lateral, la hoja impresa ni los colores; sustituir el logo por otro (eso sería otro cambio, con el logo nuevo ya generado).

## Decisions

**1. Quitar el logo en el componente, no en la configuración.** Se elimina el `<Logo>` de `BrandPanel`, `AuthLayout` y `ServerWarmupScreen`. `Logo` sigue existiendo para la barra lateral. Alternativa descartada: vaciar las rutas de `brand.logo` en `project.config.json`: rompería la barra lateral y el asistente de la plantilla.

**2. Panel de marca sin logo ni línea de derechos.** Con el logo y el pie fuera, el contenido (tagline, descripción, contacto) queda centrado verticalmente en el panel Roxo. En móvil el formulario sube sin el logo.

**3. Subtítulo del login fijo en el componente.** "Accede a tu panel de historias clínicas ortodónticas" va como texto del componente `LoginFeature` (ya no depende de `project.name`).

## Risks / Trade-offs

- El nombre "HS FACOP" sigue en otros sitios (pestaña, barra lateral, subtítulo del registro, textos de ayuda): el cambio se limita a lo pedido. Si se quiere desmarcar del todo, hace falta otro cambio.
- Sin logo, el panel de marca depende solo del color y del tagline; la pantalla es más sobria. Cuando exista un logo nuevo se vuelve a colocar con un cambio propio.

## Open Questions

- El subtítulo del registro ("Regístrate para empezar a usar HS FACOP") no se cambia en este alcance, porque solo se pidió el del login. Se anota por si se quiere igualarlo.

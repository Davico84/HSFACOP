# Proposal

## Why

La aplicación ya no se venderá a la institución FACOP. Las pantallas previas al ingreso todavía muestran el logo de esa institución, la línea "© HS FACOP" y un subtítulo que nombra a "HS FACOP"; deben dejar de identificarla.

## What Changes

- El logo de FACOP se reemplaza por un símbolo nuevo de ortodoncia (diente con brackets, sin texto) en todas las pantallas previas al ingreso (login, registro, restablecer contraseña y arranque del servidor): panel de marca de escritorio y logo móvil.
- El panel de marca deja de mostrar la línea "© HS FACOP"; conserva el logo, el tagline, la descripción y el contacto.
- Los subtítulos dejan de nombrar a HS FACOP: el del login pasa a "Accede a tu panel de historias clínicas ortodónticas" y el del registro a "Regístrate para llevar tus historias clínicas ortodónticas".
- El logo de la aplicación (barra lateral y favicon) pasa a ser un símbolo nuevo de ortodoncia (diente con brackets, sin texto), en `brand/logo-light.svg`, `logo-dark.svg`, `logo-white.svg` y `favicon.svg`. Las rutas de `project.config.json` no cambian.
- El tagline y la descripción del panel pasan a "Cada caso de ortodoncia, completo y en orden." y "Registra, retoma e imprime tus historias clínicas desde cualquier lugar." (`project.config.json`, aplicado con `pnpm project:apply`: también cambia la descripción del contrato y de la API).
- Sin cambios: la hoja imprimible de la historia (usa su propio logo) y los colores del tema.
- Sin backend, base de datos ni contrato de API.

## Capabilities

### New Capabilities
<!-- Ninguna. -->

### Modified Capabilities
- `template-bootstrap`: el Scenario "La UI muestra la identidad configurada" ya no exige logos ni el nombre en login y registro; el logo configurado se comprueba en la barra lateral.
- `project-foundation`: en "Paleta de la marca FACOP", los Scenarios "Logos oficiales" y "Panel del login" dejan de mostrar el logo en las pantallas previas al ingreso; se agrega el Scenario de pantallas previas al ingreso sin logo.

## Impact

- Frontend: `BrandPanel.tsx`, `AuthLayout.tsx`, `ServerWarmupScreen.tsx`, `LoginFeature.tsx`, `RegisterFeature.tsx` y los tests `AuthIdentity.test.tsx` y el de arranque en frío si comprueba el logo.
- Sin cambios en backend, contrato ni migraciones.

# Tasks

## 1. Frontend

- [x] 1.1 `BrandPanel`: quitar la línea "© {project.name}" y conservar el logo en blanco; centrar el contenido (tagline, descripción, contacto)
- [x] 1.2 `AuthLayout` y `ServerWarmupScreen`: conservan el logo móvil (ahora el símbolo nuevo)
- [x] 1.3 `LoginFeature` y `RegisterFeature`: subtítulos "Accede a tu panel de historias clínicas ortodónticas" y "Regístrate para llevar tus historias clínicas ortodónticas"
- [x] 1.4 Ajustar `AuthIdentity.test.tsx` a los Scenario modificados (tagline, descripción y logos visibles, sin línea de derechos, subtítulos de login y registro) y comprobar el logo configurado en la barra lateral (`AppLayout.test.tsx` ya lo cubre)
- [x] 1.5 `pnpm validate` en verde; revisar a ojo login, registro, restablecer y arranque del servidor en escritorio y móvil

- [x] 1.6 Reemplazar `brand/logo-light.svg`, `logo-dark.svg`, `logo-white.svg` y `favicon.svg` por el símbolo nuevo (hecho a mano; falta revisar la barra lateral y el favicon en el navegador)

- [x] 1.7 Nuevo tagline y descripción en `project.config.json` y `pnpm project:apply` (contrato, `application.yml` y cabecera de los clientes generados)

## 2. Docs y cierre

- [x] 2.1 `docs/vision.md`: estado del cambio al proponer y capacidad construida al archivar
- [x] 2.2 `openspec validate update-auth-screens-remove-facop-brand --strict`

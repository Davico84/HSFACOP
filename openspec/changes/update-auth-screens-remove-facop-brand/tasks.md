# Tasks

## 1. Frontend

- [ ] 1.1 `BrandPanel`: quitar el logo en blanco y la línea "© {project.name}"; centrar el contenido restante (tagline, descripción, contacto)
- [ ] 1.2 `AuthLayout` y `ServerWarmupScreen`: quitar el logo móvil
- [ ] 1.3 `LoginFeature`: subtítulo "Accede a tu panel de historias clínicas ortodónticas"
- [ ] 1.4 Ajustar `AuthIdentity.test.tsx` a los Scenario modificados (tagline y descripción visibles, sin logo ni línea de derechos, subtítulos de login y registro) y comprobar el logo configurado en la barra lateral (`AppLayout.test.tsx` ya lo cubre)
- [ ] 1.5 `pnpm validate` en verde; revisar a ojo login, registro, restablecer y arranque del servidor en escritorio y móvil

## 2. Docs y cierre

- [ ] 2.1 `docs/vision.md`: estado del cambio al proponer y capacidad construida al archivar
- [ ] 2.2 `openspec validate update-auth-screens-remove-facop-brand --strict`

# Tasks

## 1. Frontend

- [x] 1.1 `RegisterForm`: quitar el campo del código de turma y el bloque "Datos del alumno"; enviar solo nombre, correo y contraseña
- [x] 1.2 `registerSchema`: quitar `cohortCode`, `phone`, `documentType`, `documentNumber` y `copNumber`; `useRegister` ya no exceptúa el error del código de turma
- [x] 1.3 Tests por Scenario: formulario mínimo (cuatro campos, sin código ni datos), registro desde el formulario (la solicitud no lleva código ni contacto) y los existentes de contraseña corta y confirmación; retirar o reubicar los de `RegisterCohort.test.tsx` y los de datos opcionales de `RegisterForm.test.tsx`
- [ ] 1.4 `pnpm validate` en verde; revisar a ojo el registro en escritorio y móvil (botón visible, contraseña con barra de fuerza)

## 2. Docs y cierre

- [ ] 2.1 `docs/vision.md`: estado del cambio al proponer y capacidad construida al archivar
- [x] 2.2 `openspec validate update-register-simplify-form --strict`

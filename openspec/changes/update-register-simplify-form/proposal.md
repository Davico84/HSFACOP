# Proposal

## Why

El formulario de registro pide, además de nombre, correo y contraseña, un código de turma y tres datos opcionales (celular, documento y COP). La turma la asigna el `ADMIN` desde "Usuarios" y los datos se completan en "Mis datos", así que esos campos alargan el alta sin aportar nada a quien se registra.

## What Changes

- El formulario de registro queda con nombre completo, correo, contraseña y confirmación, más la nota de privacidad y el botón "Crear cuenta" siempre a la vista.
- Se quitan el campo "Código de turma (opcional)" y el bloque "Datos del alumno (opcional)" del formulario.
- La solicitud de registro deja de enviar el código de turma y los datos del alumno.
- Sin cambios en la API: sigue aceptando esos campos de forma opcional. El código de inscripción de las turmas y su apertura/cierre siguen existiendo, aunque ya no se usan desde el registro.
- Sin backend, base de datos ni contrato.

## Capabilities

### New Capabilities
<!-- Ninguna. -->

### Modified Capabilities
- `authentication`: el requirement "Registro de usuario" ya no ofrece el código de turma ni los datos del alumno en el formulario; los Scenarios de registro con datos y de formato inválido pasan a ser de la API.

## Impact

- Frontend: `RegisterForm.tsx`, `schemas/auth.ts` (`registerSchema`) y los tests `RegisterForm.test.tsx` y `RegisterCohort.test.tsx`.
- Se apoya en el change `update-auth-screens-remove-facop-brand` (mismo formulario y mismo `AuthIdentity.test.tsx`): ese va primero.

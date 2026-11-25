## Context

- `RegisterForm` arma `cohortCode` y `contactPayload(values)` en la solicitud, y maneja un error de código de turma junto al campo.
- `ContactFieldsInputs` y `contactPayload` los comparte "Mis datos" (`ProfileForm`) y no deben cambiar.
- La API de registro acepta `cohortCode` y los datos de contacto como opcionales (backend sin cambios).

## Goals / Non-Goals

**Goals:** un alta de cuatro campos, corta y sin distracciones.

**Non-Goals:** retirar el código de inscripción de las turmas, su apertura/cierre o los campos de la API (quedan sin uso desde el registro; se pueden retirar en otro change); tocar "Mis datos"; cambiar el subtítulo del registro (sigue diciendo el nombre del proyecto; lo trata el change de la marca si se quiere).

## Decisions

**1. Quitar los campos del formulario, no de la API.** Se eliminan el bloque del código de turma y el de datos del alumno, y `registerSchema` deja de tener `cohortCode`, `phone`, `documentType`, `documentNumber` y `copNumber`. La solicitud envía solo nombre, correo y contraseña. Alternativa descartada: ocultarlos con CSS o con un indicador: dejaría código muerto en el formulario.

**2. El manejo del error de código de turma sale del registro.** `COHORT_CODE_ERROR_TYPES` ya no se usa en `RegisterForm`; `useRegister` deja de exceptuar ese error del aviso, porque un código no puede enviarse desde la interfaz.

**3. Formulario más corto, mismo orden y componentes.** Nombre, correo, contraseña (con la barra de fuerza) y confirmación, nota de privacidad y botón. El botón queda visible sin desplazarse en pantallas de escritorio comunes.

## Risks / Trade-offs

- Un tratante que antes se inscribía con el código de su turma ahora queda sin turma hasta que el `ADMIN` se la asigne en "Usuarios". Es el flujo habitual descrito en el dominio.
- El código de inscripción de las turmas queda sin uso en la interfaz: los diálogos de "Turmas" siguen mostrándolo y permitiendo cerrar la inscripción. Es deuda declarada, no un error.
- Quien quiera dar su celular, documento o COP deberá hacerlo en "Mis datos" después de entrar.

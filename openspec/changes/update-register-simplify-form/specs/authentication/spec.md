## MODIFIED Requirements

### Requirement: Registro de usuario
El sistema SHALL permitir crear una cuenta con nombre completo, correo y contraseña (con confirmación de contraseña en el cliente); SHALL iniciar sesión automáticamente tras el alta y rechazar correos duplicados o datos que no cumplan las validaciones, sin crear la cuenta. El formulario NO SHALL pedir el código de turma ni los datos del alumno (celular, documento y COP): la turma la asigna el `ADMIN` y esos datos se completan en "Mis datos". La API SHALL seguir aceptándolos de forma opcional en la solicitud de registro (capacidades `cohorts` y `users`), con las mismas validaciones.

#### Scenario: Registro exitoso
- **WHEN** un visitante envía el formulario con nombre completo, correo válido y una contraseña de al menos 8 caracteres cuya confirmación coincide, con un correo no registrado
- **THEN** el sistema crea la cuenta con rol por defecto `USER`
- **AND** establece la sesión (emite token de acceso y de refresco)
- **AND** redirige al panel correspondiente a su rol

#### Scenario: Correo ya registrado
- **WHEN** un visitante intenta registrarse con un correo que ya existe
- **THEN** el sistema responde con un error de conflicto y un mensaje claro
- **AND** no crea una cuenta duplicada
- **AND** no establece ninguna sesión

#### Scenario: Contraseña demasiado corta (validación en cliente)
- **WHEN** un visitante escribe una contraseña de menos de 8 caracteres en el formulario de registro
- **THEN** el frontend muestra un error de validación en el campo
- **AND** no envía la petición al backend

#### Scenario: La confirmación de contraseña no coincide (validación en cliente)
- **WHEN** un visitante escribe una contraseña y una confirmación distintas
- **THEN** el frontend muestra un error de validación en el campo de confirmación
- **AND** no envía la petición al backend

#### Scenario: Formulario mínimo
- **WHEN** se abre el formulario de registro
- **THEN** pide solo nombre completo, correo, contraseña y su confirmación, sin código de turma ni datos del alumno

#### Scenario: Registro desde el formulario
- **WHEN** un visitante se registra con el formulario
- **THEN** la cuenta se crea como alumno individual, sin turma y sin celular, documento ni COP, y los puede completar en "Mis datos"

#### Scenario: Registro con datos del alumno por la API
- **WHEN** la solicitud de registro incluye celular "987654321", DNI "74125896" y COP "12345"
- **THEN** la cuenta se crea con esos datos y el alumno los ve en "Mis datos"

#### Scenario: Dato opcional con formato inválido por la API
- **WHEN** la solicitud de registro incluye un celular de 8 dígitos o un DNI de 7
- **THEN** el servidor responde `400` sin crear la cuenta

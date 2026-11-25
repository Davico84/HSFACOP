## MODIFIED Requirements

### Requirement: Paleta de la marca FACOP
El tema SHALL usar la paleta oficial de FACOP: Roxo `#832C87` como color principal en modo claro (botones, enlaces, foco y elementos activos), Grafite `#3C3C3B` para el texto y solo grises neutros (sin tinte) para fondos, superficies y bordes. Ningún token SHALL usar tonos fuera de la paleta salvo los semánticos de error, éxito y aviso. En modo oscuro el principal SHALL ser un Roxo aclarado. La hoja impresa SHALL imprimir texto y líneas en Preto `#000000`.

#### Scenario: Color principal en modo claro
- **WHEN** se compila el tema en modo claro
- **THEN** `--primary` es el Roxo `#832C87` y `--foreground` es el Grafite `#3C3C3B`

#### Scenario: Sin turquesa
- **WHEN** se revisan los tokens de color claros y oscuros
- **THEN** ninguno, salvo `destructive`, `success` y `warning`, tiene un tono fuera del Roxo o de los grises neutros (tampoco el degradado del login)

#### Scenario: Gris oficial no usado para texto
- **WHEN** se elige el color de texto secundario
- **THEN** es un gris neutro con contraste AA (el Gris `#808080`, de 3,9:1 sobre blanco, no se usa para texto)

#### Scenario: Modo oscuro
- **WHEN** el usuario activa el modo oscuro
- **THEN** el color principal es un Roxo aclarado legible sobre el fondo oscuro y las superficies son grises neutros oscuros

#### Scenario: Logos oficiales
- **WHEN** se abre la zona privada en modo claro o en modo oscuro
- **THEN** la barra lateral muestra el logo oficial de FACOP según el fondo (positivo sobre fondo claro, en blanco sobre fondo oscuro) y el escudo Roxo como favicon y en la barra contraída

#### Scenario: Panel del login
- **WHEN** se abre el inicio de sesión en escritorio
- **THEN** el panel de marca es Roxo liso, con el tagline, la descripción y el contacto, sin logo ni línea de derechos, sin degradado ni turquesa

#### Scenario: Pantallas previas al ingreso sin logo
- **WHEN** se abre el login, el registro, el restablecimiento de contraseña o la pantalla de arranque del servidor, en escritorio o en móvil
- **THEN** no se muestra el logo de FACOP

#### Scenario: Hoja impresa en negro
- **WHEN** se imprime una historia
- **THEN** el texto y las líneas salen en `#000000` y la hoja conserva su diseño

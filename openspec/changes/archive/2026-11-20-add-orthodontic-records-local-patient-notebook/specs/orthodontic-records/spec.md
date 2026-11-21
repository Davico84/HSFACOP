# Spec Delta

## MODIFIED Requirements

### Requirement: Búsqueda de historias sin datos del paciente en las URL
El texto buscado de un paciente (alias, número) SHALL NOT viajar en la URL de la API, en la dirección del navegador ni en parámetros de consulta. Si la búsqueda lo envía al servidor, SHALL hacerlo en el cuerpo de `POST /api/orthodontic-records/search`, con el texto limitado a 120 caracteres. La búsqueda local de la libreta SHALL pedir las historias por una lista de hasta 50 identificadores en ese mismo cuerpo, en lugar del texto. `GET /api/orthodontic-records` SHALL listar sin búsqueda.

#### Scenario: Buscar por nombre
- **WHEN** el usuario busca "mateo" en "Historias clínicas"
- **THEN** la aplicación envía `POST /api/orthodontic-records/search` con el texto en el cuerpo y ninguna URL de la petición contiene "mateo"

#### Scenario: Buscar por identificadores
- **WHEN** la búsqueda local de la libreta encuentra 3 historias
- **THEN** la aplicación envía `POST /api/orthodontic-records/search` con `recordIds` en el cuerpo, sin texto, y ninguna URL contiene identificadores
- **AND** la respuesta es el listado normal, con el mismo orden y el acceso por rol de siempre, y lleva `Cache-Control: no-store`

#### Scenario: Más de 50 identificadores
- **WHEN** el cuerpo trae 51 identificadores
- **THEN** la API responde `400` sin buscar

#### Scenario: Texto e identificadores a la vez
- **WHEN** el cuerpo trae texto y también identificadores, o ninguno de los dos
- **THEN** la API responde `400`

#### Scenario: Identificadores ajenos
- **WHEN** un `USER` pide identificadores de historias de otro tratante
- **THEN** el resultado no las incluye

#### Scenario: Paginación y turma
- **WHEN** el usuario pasa a la página 2 o la coordinación filtra por turma
- **THEN** la página y el identificador de turma viajan como parámetros de la operación y el listado respeta el acceso por rol

#### Scenario: Parámetro q retirado
- **WHEN** un cliente envía `GET /api/orthodontic-records?q=mateo`
- **THEN** la API ignora el parámetro y lista sin filtrar por ese texto

#### Scenario: Acceso por rol en la búsqueda
- **WHEN** un `USER` busca con el alias de un paciente de otro tratante
- **THEN** el resultado no incluye historias ajenas

#### Scenario: Texto en el límite
- **WHEN** el texto buscado tiene 120 caracteres, o 121
- **THEN** con 120 la API responde `200` y con 121 responde `400` sin buscar

#### Scenario: Cuerpo inválido
- **WHEN** el cuerpo está vacío, no es un objeto JSON o trae campos desconocidos
- **THEN** la API responde `400`

#### Scenario: Registros del sitio estático
- **WHEN** el usuario recarga el listado después de buscar
- **THEN** la petición del documento al sitio estático no contiene lo buscado

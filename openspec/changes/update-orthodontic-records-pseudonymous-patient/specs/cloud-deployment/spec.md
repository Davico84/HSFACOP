# Spec Delta

## ADDED Requirements

### Requirement: Copias de seguridad sin identificadores del paciente
Pasada la fecha de retiro de las columnas de identidad, la copia diaria SHALL excluir de su contenido los identificadores del paciente retirados, y las copias anteriores a esa fecha SHALL purgarse con una fecha de corte y un registro de quién las revisó. El workflow SHALL comprobar el volcado antes de cifrarlo.

#### Scenario: Volcado sin columnas retiradas
- **WHEN** el workflow genera la copia diaria después del retiro
- **THEN** comprueba que el esquema del volcado no contiene las columnas retiradas ni nombres de paciente o apoderado en el contenido de las firmas, y si los encuentra falla sin subir ningún artifact

#### Scenario: Purga de copias anteriores
- **WHEN** se cumple la fecha de corte posterior al retiro
- **THEN** se borran los artifacts y las copias descargadas anteriores a la fecha de migración, se anota quién lo verificó y la guía de restauración indica solo copias posteriores

#### Scenario: Restauración de una copia previa al retiro
- **WHEN** hace falta restaurar una copia anterior al retiro
- **THEN** solo se restaura en una base aislada, con aprobación del responsable, y se destruye al terminar

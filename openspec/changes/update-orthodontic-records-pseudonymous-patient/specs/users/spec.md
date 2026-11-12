# Spec Delta

## MODIFIED Requirements

### Requirement: Datos de contacto e identificación de la cuenta
Cada cuenta SHALL poder guardar, todos opcionales: celular (9 dígitos que empiezan con 9), documento (tipo DNI, carné de extranjería o pasaporte y su número, DNI de 8 dígitos, carné de extranjería de 9 y pasaporte de 6 a 12, siempre los dos juntos) y número de colegiatura COP (1 a 6 dígitos). Un dato con formato inválido SHALL rechazarse con `400` sin guardar nada.

#### Scenario: Datos válidos
- **WHEN** se guardan el celular "987654321", el carné de extranjería "001234567" y el COP "12345"
- **THEN** la cuenta queda con esos datos

#### Scenario: Celular inválido
- **WHEN** se envía el celular "87654321" o "887654321"
- **THEN** el sistema responde `400` con el error en el celular y no guarda nada

#### Scenario: Documento incompleto
- **WHEN** se envía un tipo de documento sin número, o un número sin tipo
- **THEN** el sistema responde `400` con el error en el campo que falta

#### Scenario: Quitar un dato
- **WHEN** se guarda el celular vacío en una cuenta que lo tenía
- **THEN** la cuenta queda sin celular


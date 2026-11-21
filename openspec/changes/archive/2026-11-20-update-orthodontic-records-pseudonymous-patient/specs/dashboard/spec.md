# Spec Delta

## MODIFIED Requirements

### Requirement: Datos faltantes en las historias del tratante
Inicio SHALL mostrar al `USER` cuántas de sus historias no tienen edad o fecha de inicio de tratamiento y, para cada paso clínico (1–7), cuántas historias calculadas lo tienen vacío: siempre los 7, de más a menos frecuente y, a igual frecuencia, por número de paso.

#### Scenario: Datos faltantes
- **WHEN** dos de sus historias no tienen edad y una no tiene fecha de inicio de tratamiento
- **THEN** Inicio muestra "2 sin edad" y "1 sin fecha de inicio", y los 7 pasos clínicos ordenados de más a menos historias vacías (a igual cantidad, por número de paso)


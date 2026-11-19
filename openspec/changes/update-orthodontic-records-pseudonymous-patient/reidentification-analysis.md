# Análisis de reidentificación (tarea 0.4)

Fecha del borrador: 2026-11-19 · Estado: **aceptado por el responsable el 2026-11-19**.

## Alcance
Qué puede identificar a un paciente con lo que el servidor guarda tras este change: alias, sexo, edad en años, número de historia, tratante, turma, fechas y contenido clínico. No incluye el papel firmado ni la libreta local, que están fuera del servidor.

## Quién podría intentarlo
- **A. Quien obtenga una copia de la base o de los registros**, sin conocer la clínica: no tiene con qué unir los datos a una persona.
- **B. Quien conoce la clínica** (el `ADMIN`, la coordinación, el propio tratante): sí puede reconocer a un paciente por alias, edad y fechas. Ya conoce a esa persona; no obtiene un dato nuevo, pero sí confirma que fue paciente y ve su contenido clínico.
- **C. Quien tenga el papel y la base juntos:** el número de historia (`AEO-NNNN`) está impreso junto al nombre en el papel y en la base junto al contenido clínico, así que une ambos.

## Campo por campo
| Campo | Riesgo | Decisión |
|---|---|---|
| Alias (máx. 30, 2 palabras, sin 6+ dígitos) | Puede ser nombre de pila más inicial del apellido, como lo siembra la migración | **Limitar**: aviso en el formulario y migración editable; se acepta que sea un nombre de pila |
| Sexo | Dos valores, no identifica | **Aceptar** |
| Edad en años | Un dato grueso | **Aceptar** |
| Número de historia | Une con el papel (grupo C) | **Aceptar**: es la clave que ata el papel oficial a la base |
| Tratante y turma | Reducen el grupo a pocas personas (grupo B) | **Aceptar**: ya lo conocen quienes tienen acceso |
| Fecha de inicio y de modificación | Con alias y tratante, estrechan el grupo | **Aceptar** |
| Contenido clínico estructurado (medidas, análisis, diagnóstico) | Muy individual, pero no identifica sin acceso al paciente | **Aceptar** |
| Texto libre (queja principal, antecedentes, hábitos, estructura familiar, conclusiones) | Pueden escribirse nombres, parentescos o lugares | **Limitar**: aviso permanente; no se detecta de forma técnica |
| Motivo de desbloqueo | Antes era texto libre | **Eliminar**: pasa a catálogo cerrado |
| Copias de seguridad anteriores a la migración | Conservan los datos retirados | **Limitar**: purga con fecha de corte (spec `cloud-deployment`) |

## Afirmación que se puede sostener
> «El servidor no guarda nombre completo, documento, fecha ni lugar de nacimiento, domicilio ni celular del paciente.»

**No** se puede afirmar que el servidor no guarda datos identificables: quien conoce la clínica, o tiene el papel, puede reconocer a un paciente. Tampoco que no existan datos de salud: el contenido clínico sigue ahí.

## Riesgos que se aceptan
1. Reconocimiento por parte de quien ya conoce al paciente (grupo B).
2. Unión papel–base por el número de historia (grupo C).
3. Nombres escritos por error en textos libres; solo se avisa.
4. Registros y copias de antes de la migración, hasta su purga.

## Aceptación
El responsable acepta por escrito el análisis, las decisiones y la afirmación de arriba.

- Responsable: David Velarde Alvarado
- Fecha: 2026-11-19

## Context

Estado observado antes de este change (2026-11-25):

- Producción está en Flyway V24. La acción de migración corrió contra Neon: 11 historias migradas, 0 pendientes, verificación en cero.
- La entidad `OrthodonticRecord` **ya no mapea** las columnas antiguas (documento, nacimiento, lugar, domicilio, celular, `legacy_*`); `ddl-auto` es `none`. Solo las leen `LegacyIdentityQueries` (JDBC, endpoint de datos antiguos, con la ventana cerrada) e `IdentityMigration`. La entidad sí mapea `notebook_backup_confirmed_at`, que escribe únicamente `confirmNotebookBackup`, y este solo funciona con la ventana de copia abierta. **Por eso el binario de producción dejaría de funcionar si esa columna desaparece mientras está vivo** (descubierto al verificar la tarea 3.2).
- La copia de seguridad diaria (`db-backup.yml`) vuelca y restaura la base completa en un Postgres efímero para verificarla; no comprueba columnas retiradas.
- Existen copias con datos reales: la rama de Neon `backup-antes-alias-2026-11-25` (tomada justo antes de migrar), artifacts `db-backup` anteriores y archivos descargados.

Motivación en `proposal.md`. Despliegue y rollback generales en `docs/deployment.md`.

## Goals / Non-Goals

**Goals:**
- Que el esquema no contenga identificadores del paciente y que el retiro sea imposible con datos dentro.
- Retirar el código y la configuración de la transición sin tocar la libreta.
- Purgar las copias con datos reales dejando un registro verificable.

**Non-Goals:**
- Cambiar la libreta local, su exportación o la impresión.
- Reescribir el historial de Flyway: V8, V17, V19, V21 y V22 no se editan, sus checksums ya están aplicados.

## Decisions

### D1. Un solo despliegue, sin binario intermedio
El diseño original pedía desplegar primero un binario que no mapee las columnas y después el retiro. Eso ya se cumple: el binario en producción no mapea las columnas antiguas y solo las toca el endpoint cerrado. Por eso el binario nuevo (sin ese endpoint) y V25 salen juntos: Flyway aplica V25 al arrancar, y la instancia anterior, que sigue atendiendo mientras tanto, solo usaría las columnas si alguien llamara al endpoint de datos antiguos, que responde cerrado desde la fecha límite.
- *Alternativa:* dos despliegues (primero sin el endpoint, luego V25). Se descarta: añade un ciclo sin reducir un riesgo real.
- Se verifica con una prueba de arranque contra el esquema con y sin las columnas (tarea 3.2).

### D2. Retiro guardado en la propia migración
V25 abre con un bloque que cuenta las filas con valor en cualquiera de las columnas y, si hay alguna, lanza una excepción con solo el conteo. Después ejecuta los `ALTER TABLE … DROP COLUMN`. Las restricciones `ck_orthodontic_records_document_type` y `ck_orthodontic_records_document_pair` caen con sus columnas. `legacy_signatures` cuenta como vacía si es nula; el script administrativo la deja nula.
- *Alternativa:* borrar sin guarda. Se descarta: el borrado es irreversible y la guarda cuesta una consulta.
- El mensaje no incluye valores (Scenario "Retiro con historias pendientes").

### D3. La marca de respaldo se retira con la copia, la columna después
`notebook_backup_confirmed_at` y `confirmNotebookBackup` existían solo para la copia: sin ventana abierta el endpoint respondería siempre `404`. Se retiran el endpoint, el servicio y el campo de la entidad, y se ajusta la cuenta vencida (ya no menciona confirmar el respaldo). La **columna** no se borra en V25: no es un dato del paciente y la entidad del binario en producción todavía la mapea, así que borrarla en el mismo despliegue haría fallar las consultas de la instancia anterior mientras arranca la nueva. Se elimina en una migración posterior (V26), ya con este binario en producción.
- *Alternativa:* conservarla para un futuro indicador "Respaldada". Se descarta: ese indicador está pausado y se diseñaría junto con la libreta, no sobre esta marca.
- *Alternativa:* borrarla en V25 y aceptar unos segundos de errores durante el cambio de instancia. Se descarta: el costo de esperar un despliegue es nulo y evita un fallo conocido.

### D4. Se retira el requisito de la acción, no solo el código
El requisito "Migración de las historias existentes al alias" describe una operación puntual ya ejecutada. Sus dos escenarios de retiro pasan a un requisito permanente (esquema sin identificadores). La validación de la menarquia frente a la edad vive en su propio requisito y sigue vigente; el escenario "Historia migrada con datos clínicos inconsistentes" desaparece con la acción.

### D5. Comprobación del volcado en CI
Tras la restauración de verificación, el workflow consulta `information_schema.columns` de la base restaurada y falla si existe alguna columna retirada; también consulta el contenido de las firmas (`content -> 'signatures'`) y falla si encuentra `patientSignatureName`, `guardianName` o `guardianRelationship`. Falla antes de cifrar y de subir el artifact. Los nombres de columnas no son datos del paciente, así que el registro del workflow, que es público, no filtra nada.

### D6. Purga como paso operativo con registro
La purga no es código. Se hace después de verificar V25 en producción y queda registrada en `docs/deployment.md` (fecha de corte, qué se borró, quién lo verificó): rama de Neon, artifacts `db-backup` anteriores a la fecha de corte (los posteriores ya pasan la comprobación de D5) y archivos descargados. Los archivos de libreta de cada tratante son suyos y no se tocan.

## Risks / Trade-offs

- **[Retiro irreversible]** → la rama de Neon se conserva hasta verificar V25 en producción y solo después se purga. Tras V25 se prohíbe volver a un binario anterior: solo se restaura una copia verificada en un entorno aislado.
- **[Una historia nueva con valor en las columnas antes del retiro]** → imposible desde la API (el servidor no las escribe) y la guarda de V25 aborta si ocurriera.
- **[Instancia anterior viva durante el arranque]** → ver D1: la entidad anterior ya no mapea ninguna de las columnas que borra V25 (la marca de respaldo se conserva por eso, D3) y el único camino que las leería, el endpoint de datos antiguos, está cerrado.
- **[`LEGACY_COPY_DEADLINE` sigue en Render]** → Spring ignora variables sin propiedad; se elimina después del despliegue, sin prisa.
- **[Retirar `confirmNotebookBackup` cambia el contrato]** → el cliente generado se regenera y `mvn verify` compara `contracts/openapi.json`.
- **[Se pierde la rama de Neon como red de seguridad]** → se acepta: es el objetivo de la purga y ocurre solo tras la verificación.

## Migration Plan

1. Merge del change y de su PR; el CI valida V25 sobre una base con historias ya migradas y sobre una con valores (aborta).
2. Render despliega el binario nuevo y Flyway aplica V25. Se comprueba el arranque, el inicio de sesión, abrir, guardar e imprimir una historia migrada.
3. Con la aplicación funcionando, se corre `db-backup` manualmente: debe pasar la comprobación de D5.
4. Purga (D6) y registro. Quitar `LEGACY_COPY_DEADLINE` de Render.
5. Rollback: antes del paso 2 nada cambia. Después, solo restaurar una copia verificada en un entorno aislado (la rama de Neon mientras exista).

## Why

La acción administrativa de migración al alias se ejecutó en producción el 2026-11-25 (11 historias migradas, verificación final en cero: ninguna historia con columnas retiradas con valor, con nombres de firma ni con motivos en texto libre). Las columnas con la identidad antigua del paciente están vacías pero siguen en el esquema, junto con el código que solo existía para la transición (ventana de copia, endpoint de datos antiguos, script de migración). Cerrar el retiro hace verdad la afirmación del esquema ("no contiene identificadores del paciente") y deja de ofrecer una superficie que ya no sirve. Cubre las tareas 3.3, 3.4 y 3.5 pendientes de `update-orthodontic-records-pseudonymous-patient`.

## What Changes

- **BREAKING (esquema):** migración **V25** que elimina de `orthodontic_records` las columnas `document_type`, `document_number`, `birth_date`, `birth_place`, `address`, `phone`, `legacy_patient_name` y `legacy_signatures`, con sus restricciones. La marca de respaldo de la libreta (`notebook_backup_confirmed_at`, V23) deja de usarse en el código pero su columna se conserva en V25 y se elimina en una migración posterior (ver `design.md` D3). Antes de borrar comprueba que ninguna fila conserva valores y, si alguna los conserva, aborta con un error sin ningún valor y sin cambiar el esquema.
- Se retira todo lo que solo servía a la transición: la acción administrativa (`IdentityMigration`, `IdentityMigrationRunner`, `LegacyAlias`), la ventana de copia (`LegacyCopyProperties` y la variable `LEGACY_COPY_DEADLINE`), la consulta y el endpoint de datos antiguos (`GET /orthodontic-records/{id}/legacy-identity`) y la confirmación de respaldo de la libreta (`confirmNotebookBackup` y su marca), que solo la escribía la copia.
- Frontend: se retira el aviso "Pasar a mi libreta" (copia, exportación y verificación de los datos antiguos) y se regenera el cliente de la API. La libreta local, su exportación y sus campos de impresión **no cambian**.
- Copias de seguridad: el workflow `db-backup.yml` comprueba antes de cifrar que el volcado no contiene las columnas retiradas ni nombres de firma del paciente o apoderado, y se purgan las copias anteriores al retiro con fecha de corte y registro de quién lo verificó.
- `docs/deployment.md` documenta el retiro, la purga y la prohibición de volver a un binario anterior a V25 sin restaurar una copia verificada en un entorno aislado.

## Capabilities

### New Capabilities
- Ninguna.

### Modified Capabilities
- `orthodontic-records`: se retira el requisito de la acción administrativa de migración (ya ejecutada) y se agrega el del esquema sin identificadores del paciente con el retiro guardado; la cuenta vencida deja de mencionar la confirmación del respaldo de la libreta.
- `patient-notebook`: se retira el requisito de copia de las historias existentes a la libreta (ventana cerrada, datos borrados).

`cloud-deployment` ya exige el volcado sin columnas retiradas y la purga (escenarios "Volcado sin columnas retiradas", "Purga de copias anteriores" y "Restauración de una copia previa al retiro"); este change los implementa, sin cambiar el spec.

## Impact

- Backend: migración V25, entidad `OrthodonticRecord` (el campo de la marca de respaldo deja de mapearse), servicio y controlador de historias, `RecordsConfig`, `application.yml`, paquete `service/records/migration`, `LegacyIdentityQueries`, DTO de datos antiguos y sus tests; `contracts/openapi.json` regenerado.
- Frontend: `NotebookLegacyCopy`, `legacyCopy.ts`, sus tests y el cliente generado.
- CI: `.github/workflows/db-backup.yml`.
- Docs: `docs/deployment.md`, `docs/domain.md`, `docs/vision.md`; variable `LEGACY_COPY_DEADLINE` fuera de Render tras el despliegue.
- Operación (sin código): purga de la rama de Neon `backup-antes-alias-2026-11-25`, de los artifacts `db-backup` anteriores y de las descargas.

## Non-goals

- Cambiar la libreta local del tratante, su exportación cifrada o la impresión con sus datos.
- Un indicador "Respaldada" en la interfaz (pausado; la marca que lo habría alimentado se retira).
- Retirar el código de inscripción de las turmas (otro change).
- Cambios en la identificación por alias, sexo y edad.

Guías perennes de despliegue y de copias en `docs/deployment.md`; modelo del paciente en `docs/domain.md`.

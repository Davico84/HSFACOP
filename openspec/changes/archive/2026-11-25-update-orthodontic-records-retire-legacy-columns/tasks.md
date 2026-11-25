## 1. Backend: retiro del esquema y del código de la transición

- [x] 1.1 Migración `V25__retire_legacy_identity.sql`: guarda que aborta con solo el conteo si alguna fila conserva valores en las columnas retiradas y después elimina `document_type`, `document_number`, `birth_date`, `birth_place`, `address`, `phone`, `legacy_patient_name` y `legacy_signatures` (la columna `notebook_backup_confirmed_at` se conserva hasta V26, design D3); verificar con un test de migración sobre una base con historias migradas (retira) y sobre otra con un valor (aborta sin cambiar el esquema ni mostrar el valor), Scenario "Retiro del esquema" y "Retiro con historias pendientes"
- [x] 1.2 Quitar `IdentityMigration`, `IdentityMigrationRunner`, `LegacyAlias`, `LegacyIdentityQueries`, `LegacyIdentityView`, `LegacyIdentityResponse`, `LegacyCopyProperties` y su registro en `RecordsConfig`, la clave `legacy-copy` de `application.yml` y los tests `IdentityMigrationIT` y `LegacyIdentityIT`; verificar que `mvn -DskipTests package` compila y que `grep` no encuentra referencias
- [x] 1.3 Quitar de `OrthodonticRecordsController` y `OrthodonticRecordService` el endpoint `getLegacyIdentity` y `confirmNotebookBackup`, y de la entidad el campo `notebookBackupConfirmedAt`; verificar con un test de API que `GET /orthodontic-records/{id}/legacy-identity` responde `404` y que abrir, guardar e imprimir una historia migrada sigue funcionando (Scenario "Datos antiguos ya no disponibles")
- [x] 1.4 Ajustar los tests que mencionan lo retirado (`NotebookBackendIT`, `OrthodonticRecordsIT`, `PseudonymousPatientExpandMigrationIT`, y `UserAccountStatusIT` si aplica) ; el arranque contra el esquema con y sin las columnas se comprueba en 3.2; verificar con `mvn verify` en verde
- [x] 1.5 Regenerar `contracts/openapi.json`; verificar que `mvn verify` pasa la comparación del contrato

## 2. Frontend: sin el aviso de copia

- [x] 2.1 Quitar `NotebookLegacyCopy`, `notebook/legacyCopy.ts`, `RecordLegacyCopy.test.tsx` y su uso en `NotebookPatientFields`; regenerar el cliente (`pnpm generate:api`); verificar que `pnpm validate` pasa y que la libreta (campos, exportación e importación) conserva sus tests
- [x] 2.2 Ajustar `RecordReadOnly.test.tsx` y cualquier fixture que use la marca de respaldo o los datos antiguos; verificar con `pnpm validate`

## 3. Verificación previa al despliegue

- [x] 3.1 Comprobar con `grep` que no quedan referencias a las columnas retiradas, a `LEGACY_COPY_DEADLINE`, a `legacy-identity` ni a `confirmNotebookBackup` fuera de las migraciones ya aplicadas y de lo archivado; verificar que la salida solo lista migraciones antiguas, V25 y los tests que las citan
- [x] 3.2 Probar el arranque del binario nuevo contra una base con V24 (con columnas) y contra una con V25 (sin columnas), y el del binario de `main` actual contra el esquema de V25 para confirmar D1; verificar que arrancan y que abrir una historia funciona

## 4. CI: volcado sin identificadores

- [x] 4.1 En `.github/workflows/db-backup.yml`, tras la restauración y antes de cifrar, fallar si la base restaurada tiene alguna columna retirada o si el contenido de las firmas contiene `patientSignatureName`, `guardianName` o `guardianRelationship`, sin imprimir valores; verificar con una prueba local del SQL sobre una base con una columna presente (la nombra) y sin ella (vacío); la ejecución manual del workflow tras el despliegue es la tarea 6.1, Scenario "Volcado sin columnas retiradas"

## 5. Documentación e integración

- [x] 5.1 `docs/deployment.md`: pasos 3 a 7 marcados como hechos con fechas, `LEGACY_COPY_DEADLINE` fuera de la tabla de variables, prohibición de volver a un binario anterior a V25 y registro de la purga; `docs/domain.md` sin la marca de respaldo ni los datos antiguos; `docs/vision.md` enlaza el change en progreso y se cierra al archivar; verificar que enlazan este change
- [x] 5.2 `openspec validate update-orthodontic-records-retire-legacy-columns --strict`, `mvn verify` y `pnpm validate` en verde; verificar la salida de los tres

## 6. Operación tras el despliegue (sin código)

- [x] 6.1 Desplegar en Render, comprobar inicio de sesión, abrir, guardar e imprimir una historia migrada y correr `db-backup` manualmente; verificar que el workflow pasa
- [x] 6.2 Purgar la rama de Neon `backup-antes-alias-2026-11-25`, los artifacts `db-backup` anteriores a la fecha de corte y las descargas, y quitar `LEGACY_COPY_DEADLINE` de Render; verificar con una lista de artifacts y de ramas sin las copias anteriores y registrarlo en `docs/deployment.md` con fecha y quién lo verificó, Scenario "Purga de copias anteriores"

## Workflow follow-up

- Migración **V26** (change aparte, tras desplegar este): `ALTER TABLE orthodontic_records DROP COLUMN notebook_backup_confirmed_at`. No hay prisa; el código ya no la usa.

-- Capacidad orthodontic-records — update-orthodontic-records-pseudonymous-patient.
-- Hasta la fecha límite de copia (LEGACY_COPY_DEADLINE) el autor de cada historia puede copiar a su
-- libreta local los datos antiguos del paciente. patient_name pasa a guardar el alias en cuanto el
-- tratante lo escribe, y el contenido deja de guardar los nombres de firma al primer guardado: para
-- que ninguna edición destruya lo que aún no se copió, se conserva aquí el nombre original y los
-- nombres de firma. Las demás columnas antiguas (documento, nacimiento, lugar, domicilio y celular)
-- ya no las escribe el servidor nuevo y se quedan como estaban. El script administrativo vacía estas
-- dos columnas y una migración guardada las elimina junto con las demás.
ALTER TABLE orthodontic_records ADD COLUMN legacy_patient_name VARCHAR(120);
ALTER TABLE orthodontic_records ADD COLUMN legacy_signatures JSONB;

UPDATE orthodontic_records
SET legacy_patient_name = patient_name,
    legacy_signatures = NULLIF(jsonb_strip_nulls(jsonb_build_object(
        'patientSignatureName', content -> 'signatures' ->> 'patientSignatureName',
        'guardianName', content -> 'signatures' ->> 'guardianName',
        'guardianRelationship', content -> 'signatures' ->> 'guardianRelationship')), '{}'::jsonb);

-- Capacidad orthodontic-records — expansión de update-orthodontic-records-pseudonymous-patient.
-- El paciente pasa a identificarse por alias (columna patient_name), sexo y edad escrita en años.
-- Solo AÑADE columnas: las de identidad antiguas (documento, nacimiento, lugar, domicilio y
-- celular) no se tocan, para poder volver al binario anterior hasta el retiro. El servidor nuevo
-- ya no las escribe ni las mapea; el script administrativo las vacía y una migración guardada las
-- elimina (ver design.md D8).
ALTER TABLE orthodontic_records ADD COLUMN patient_age SMALLINT
    CONSTRAINT ck_orthodontic_records_patient_age CHECK (patient_age BETWEEN 0 AND 99);
ALTER TABLE orthodontic_records ADD COLUMN identity_migrated_at TIMESTAMPTZ;

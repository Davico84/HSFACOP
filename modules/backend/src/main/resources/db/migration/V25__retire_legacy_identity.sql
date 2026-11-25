-- Capacidad orthodontic-records — update-orthodontic-records-retire-legacy-columns.
-- Retiro de las columnas con la identidad antigua del paciente, una vez ejecutada la acción
-- administrativa que las vació (V21 y V22 las dejaron sin tocar para poder volver al binario
-- anterior). Es irreversible: antes de borrar se comprueba que ninguna fila conserva un valor, y si
-- alguna lo conserva se aborta sin cambiar el esquema. El error lleva solo el conteo, nunca un valor.
DO $$
DECLARE
    pending BIGINT;
BEGIN
    SELECT count(*) INTO pending
    FROM orthodontic_records
    WHERE document_type IS NOT NULL OR document_number IS NOT NULL OR birth_date IS NOT NULL
       OR birth_place IS NOT NULL OR address IS NOT NULL OR phone IS NOT NULL
       OR legacy_patient_name IS NOT NULL OR legacy_signatures IS NOT NULL;
    IF pending > 0 THEN
        RAISE EXCEPTION 'V25 abortada: % historias conservan datos en las columnas de identidad retiradas', pending;
    END IF;
END
$$;

-- Las restricciones ck_orthodontic_records_document_type y ck_orthodontic_records_document_pair
-- caen con sus columnas. notebook_backup_confirmed_at (V23) NO se borra aquí: no es un dato del
-- paciente y el binario anterior todavía la mapea en la entidad, así que borrarla en el mismo
-- despliegue rompería a la instancia que sigue atendiendo mientras arranca la nueva. El código nuevo
-- ya no la usa; se elimina en una migración posterior, con el binario nuevo ya en producción.
ALTER TABLE orthodontic_records
    DROP COLUMN document_type,
    DROP COLUMN document_number,
    DROP COLUMN birth_date,
    DROP COLUMN birth_place,
    DROP COLUMN address,
    DROP COLUMN phone,
    DROP COLUMN legacy_patient_name,
    DROP COLUMN legacy_signatures;

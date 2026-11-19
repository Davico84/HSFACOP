-- Capacidad orthodontic-records — add-orthodontic-records-local-patient-notebook.
-- Marca (sin datos del paciente) de que el autor copió los datos antiguos de su historia a su libreta
-- local, exportó un archivo cifrado y lo verificó. Solo informativa: pasada la fecha límite de copia
-- la migración borra igual lo que no se respaldó (design D10).
ALTER TABLE orthodontic_records ADD COLUMN notebook_backup_confirmed_at TIMESTAMPTZ;

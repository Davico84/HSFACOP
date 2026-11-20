package com.odontorisas.service.records.migration;

import com.odontorisas.common.text.SearchNormalizer;
import com.odontorisas.infra.config.LegacyCopyProperties;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import java.sql.Date;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.Period;
import java.util.List;
import java.util.Optional;

/**
 * Acción administrativa única de update-orthodontic-records-pseudonymous-patient (design D8, tiempo 2):
 * pasa las historias existentes al formato con alias y edad escrita y borra los datos antiguos del
 * paciente. No es un endpoint: la lanza {@link IdentityMigrationRunner} con confirmación del operador.
 *
 * <p>Cada historia se procesa en su <b>propia transacción</b> y termina marcada con
 * {@code identity_migrated_at}; esa marca, no la edad ni el alias, decide si se omite al reejecutar. Por
 * historia: alias inicial desde el nombre original (salvo que el autor ya haya escrito uno), edad
 * calculada una sola vez desde la fecha de nacimiento (salvo que el autor ya la haya escrito), texto de
 * búsqueda reconstruido, columnas antiguas vaciadas, nombres de firma del paciente y del apoderado
 * borrados del contenido y motivos de desbloqueo en texto libre reemplazados por {@code OTRO}.
 *
 * <p>Nunca registra valores: solo conteos. El alias propuesto se puede listar para la revisión previa.
 */
@Component
public class IdentityMigration {

    private static final String CATALOG = "'ALIAS','SEXO','EDAD','OTRO'";

    private final JdbcClient jdbc;
    private final TransactionTemplate tx;
    private final Clock clock;
    private final LegacyCopyProperties legacyCopy;

    public IdentityMigration(JdbcClient jdbc, TransactionTemplate tx, Clock clock, LegacyCopyProperties legacyCopy) {
        this.jdbc = jdbc;
        this.tx = tx;
        this.clock = clock;
        this.legacyCopy = legacyCopy;
    }

    /** Historia pendiente con lo necesario para decidir su alias y su edad. */
    private record Pending(long id, String recordNumber, String patientName, String legacyName, LocalDate birthDate,
                           LocalDate treatmentStart, Integer patientAge) {
    }

    /** Alias que recibirá una historia, para la revisión previa (sin ningún otro dato del paciente). */
    public record AliasLine(long id, String recordNumber, String alias) {
    }

    /** Conteos de la acción; ningún valor del paciente. */
    public record Result(int migrated, int skippedAlreadyMigrated, int remaining) {
    }

    /** Conteos posteriores a la acción; todo debe ser cero para retirar las columnas. */
    public record Verification(int rowsWithRetiredColumns, int rowsWithRetiredSignatureNames,
                               int rowsWithFreeTextUnlockReasons) {
        public boolean clean() {
            return rowsWithRetiredColumns == 0 && rowsWithRetiredSignatureNames == 0 && rowsWithFreeTextUnlockReasons == 0;
        }
    }

    /** La acción solo corre con una fecha límite configurada y ya vencida. */
    public void requireWindowClosed() {
        if (legacyCopy.deadline() == null) {
            throw new IllegalStateException("No hay fecha límite de copia configurada (LEGACY_COPY_DEADLINE): no se migra.");
        }
        if (legacyCopy.isOpenAt(clock.instant())) {
            throw new IllegalStateException("La fecha límite de copia aún no venció: los autores todavía pueden copiar sus datos.");
        }
    }

    public int pendingCount() {
        return jdbc.sql("SELECT count(*) FROM orthodontic_records WHERE identity_migrated_at IS NULL")
            .query(Integer.class).single();
    }

    /** Alias que se asignarían a las historias pendientes (los que el autor ya escribió se respetan). */
    public List<AliasLine> previewAliases() {
        return pending().stream().map(p -> new AliasLine(p.id(), p.recordNumber(), aliasOf(p))).toList();
    }

    /** Historias pendientes por autor sin respaldo en la libreta local (solo informativo); vacío si la marca no existe aún. */
    public Optional<List<UnbackedByAuthor>> unbackedByAuthor() {
        boolean column = jdbc.sql("""
                SELECT count(*) FROM information_schema.columns
                WHERE table_schema = current_schema() AND table_name = 'orthodontic_records'
                  AND column_name = 'notebook_backup_confirmed_at'""").query(Integer.class).single() > 0;
        if (!column) {
            return Optional.empty();
        }
        return Optional.of(jdbc.sql("""
                SELECT author_id, count(*) AS records FROM orthodontic_records
                WHERE identity_migrated_at IS NULL AND notebook_backup_confirmed_at IS NULL
                GROUP BY author_id ORDER BY author_id""")
            .query((rs, i) -> new UnbackedByAuthor(rs.getLong("author_id"), rs.getInt("records"))).list());
    }

    public record UnbackedByAuthor(long authorId, int records) {
    }

    /** Historias con la edad registrada en contradicción con la primera menstruación ya guardada. */
    public int inconsistentCount() {
        return jdbc.sql("""
                SELECT count(*) FROM orthodontic_records
                WHERE patient_sex = 'FEMALE' AND patient_age IS NOT NULL
                  AND content -> 'anamnesis' ->> 'menarche' = 'YES'
                  AND (patient_age < 8
                       OR (content -> 'anamnesis' ->> 'menarcheAge') ~ '^[0-9]+$'
                          AND (content -> 'anamnesis' ->> 'menarcheAge')::int > patient_age)""")
            .query(Integer.class).single();
    }

    /** Migra todas las historias pendientes. */
    public Result migrate() {
        return migrate(Integer.MAX_VALUE);
    }

    /** Migra hasta {@code limit} historias pendientes (una transacción cada una); sirve para reanudar. */
    public Result migrate(int limit) {
        requireWindowClosed();
        int alreadyMigrated = jdbc.sql("SELECT count(*) FROM orthodontic_records WHERE identity_migrated_at IS NOT NULL")
            .query(Integer.class).single();
        int migrated = 0;
        for (Pending record : pending()) {
            if (migrated >= limit) {
                break;
            }
            tx.executeWithoutResult(status -> migrateOne(record));
            migrated++;
        }
        return new Result(migrated, alreadyMigrated, pendingCount());
    }

    private List<Pending> pending() {
        return jdbc.sql("""
                SELECT id, record_number, patient_name, legacy_patient_name, birth_date, treatment_start_date, patient_age
                FROM orthodontic_records WHERE identity_migrated_at IS NULL ORDER BY id""")
            .query((rs, i) -> {
                Date birth = rs.getDate("birth_date");
                Date start = rs.getDate("treatment_start_date");
                // wasNull() se refiere a la última columna leída: se lee justo después de getInt.
                int age = rs.getInt("patient_age");
                Integer writtenAge = rs.wasNull() ? null : age;
                return new Pending(rs.getLong("id"), rs.getString("record_number"), rs.getString("patient_name"),
                    rs.getString("legacy_patient_name"), birth == null ? null : birth.toLocalDate(),
                    start == null ? null : start.toLocalDate(), writtenAge);
            }).list();
    }

    /**
     * El alias que ya está guardado se respeta cuando el autor lo escribió (distinto del nombre original) o
     * cuando la historia nació después del cambio (no tiene nombre original); si no, se propone uno.
     */
    private static String aliasOf(Pending p) {
        if (p.legacyName() == null || !p.legacyName().equals(p.patientName())) {
            return p.patientName() == null || p.patientName().isBlank() ? LegacyAlias.fromName(null) : p.patientName();
        }
        return LegacyAlias.fromName(p.legacyName());
    }

    /** Edad escrita por el autor, o calculada una sola vez desde el nacimiento; vacía sin nacimiento o fuera de 0 a 99. */
    private Integer ageOf(Pending p) {
        if (p.patientAge() != null || p.birthDate() == null) {
            return p.patientAge();
        }
        LocalDate reference = p.treatmentStart() != null ? p.treatmentStart() : LocalDate.now(clock);
        if (reference.isBefore(p.birthDate())) {
            return null;
        }
        int age = Period.between(p.birthDate(), reference).getYears();
        return age >= 0 && age <= 99 ? age : null;
    }

    private void migrateOne(Pending p) {
        String alias = aliasOf(p);
        Instant now = clock.instant();
        int updated = jdbc.sql("""
                UPDATE orthodontic_records SET
                    patient_name = :alias, patient_age = :age, search_text = :search,
                    document_type = NULL, document_number = NULL, birth_date = NULL, birth_place = NULL,
                    address = NULL, phone = NULL, legacy_patient_name = NULL, legacy_signatures = NULL,
                    content = content #- '{signatures,patientSignatureName}' #- '{signatures,guardianName}'
                                       #- '{signatures,guardianRelationship}',
                    unlock_request_reason = CASE WHEN unlock_request_reason IS NULL
                        OR unlock_request_reason IN (%s) THEN unlock_request_reason ELSE 'OTRO' END,
                    identity_migrated_at = :now
                WHERE id = :id AND identity_migrated_at IS NULL""".formatted(CATALOG))
            .param("alias", alias)
            .param("age", ageOf(p))
            .param("search", SearchNormalizer.normalize(alias + " " + p.recordNumber()))
            .param("now", java.sql.Timestamp.from(now))
            .param("id", p.id())
            .update();
        if (updated == 1) {
            jdbc.sql("UPDATE record_unlock_events SET reason = 'OTRO' WHERE record_id = :id AND reason IS NOT NULL "
                    + "AND reason NOT IN (" + CATALOG + ")")
                .param("id", p.id()).update();
        }
    }

    /** Comprueba que no queda ningún dato retirado ni texto libre; devuelve solo conteos. */
    public Verification verify() {
        int columns = jdbc.sql("""
                SELECT count(*) FROM orthodontic_records
                WHERE document_type IS NOT NULL OR document_number IS NOT NULL OR birth_date IS NOT NULL
                   OR birth_place IS NOT NULL OR address IS NOT NULL OR phone IS NOT NULL
                   OR legacy_patient_name IS NOT NULL OR legacy_signatures IS NOT NULL""").query(Integer.class).single();
        int signatures = jdbc.sql("""
                SELECT count(*) FROM orthodontic_records
                WHERE jsonb_exists(content -> 'signatures', 'patientSignatureName')
                   OR jsonb_exists(content -> 'signatures', 'guardianName')
                   OR jsonb_exists(content -> 'signatures', 'guardianRelationship')""").query(Integer.class).single();
        int reasons = jdbc.sql("SELECT (SELECT count(*) FROM orthodontic_records WHERE unlock_request_reason IS NOT NULL "
                + "AND unlock_request_reason NOT IN (" + CATALOG + ")) + (SELECT count(*) FROM record_unlock_events "
                + "WHERE reason IS NOT NULL AND reason NOT IN (" + CATALOG + "))").query(Integer.class).single();
        return new Verification(columns, signatures, reasons);
    }
}

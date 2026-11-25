package com.odontorisas.persistence;

import com.odontorisas.AbstractIntegrationTest;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationVersion;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import javax.sql.DataSource;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * V25 (update-orthodontic-records-retire-legacy-columns) en un schema propio migrado hasta V24:
 * elimina las columnas de identidad antigua si ninguna fila conserva valores (la marca de respaldo de
 * la libreta se queda: el binario anterior todavía la mapea) y aborta sin cambiar el esquema, y sin mostrar ningún valor, si alguna los conserva.
 */
@SpringBootTest
class RetireLegacyIdentityMigrationIT extends AbstractIntegrationTest {

    private static final List<String> RETIRED = List.of("document_type", "document_number", "birth_date",
        "birth_place", "address", "phone", "legacy_patient_name", "legacy_signatures");

    @Autowired DataSource dataSource;

    private Flyway flyway(String schema, String target) {
        return Flyway.configure().dataSource(dataSource).schemas(schema).defaultSchema(schema).createSchemas(true)
            .locations("classpath:db/migration").target(MigrationVersion.fromVersion(target)).load();
    }

    private long author(JdbcTemplate jdbc, String schema) {
        return jdbc.queryForObject("INSERT INTO " + schema + ".users (email, password_hash, role, full_name, expires_on) "
            + "VALUES (?, 'h', 'USER', 'Dra. Torres', DATE '2030-01-01') RETURNING id", Long.class,
            "v25-" + UUID.randomUUID() + "@empresa.test");
    }

    private List<String> columns(JdbcTemplate jdbc, String schema) {
        return jdbc.queryForList("SELECT column_name FROM information_schema.columns "
            + "WHERE table_schema = ? AND table_name = 'orthodontic_records'", String.class, schema);
    }

    @Test
    void retires_the_columns_when_every_record_was_already_migrated() {
        JdbcTemplate jdbc = new JdbcTemplate(dataSource);
        String schema = "v25_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        flyway(schema, "24").migrate();
        long author = author(jdbc, schema);
        // Historia ya migrada: alias, edad y marca; las columnas antiguas vacías. La marca de respaldo puede tener valor.
        jdbc.update("INSERT INTO " + schema + ".orthodontic_records (author_id, record_number, patient_name, patient_age, "
            + "identity_migrated_at, notebook_backup_confirmed_at, search_text, content) "
            + "VALUES (?, 'AEO-0001', 'Ana Q', 13, now(), now(), 'ana q', CAST('{}' AS jsonb))", author);
        assertThat(columns(jdbc, schema)).containsAll(RETIRED);

        flyway(schema, "25").migrate();

        assertThat(columns(jdbc, schema)).doesNotContainAnyElementsOf(RETIRED)
            .contains("patient_name", "patient_age", "patient_sex", "identity_migrated_at", "search_text", "content",
                "notebook_backup_confirmed_at");
        assertThat(jdbc.queryForObject("SELECT patient_name FROM " + schema + ".orthodontic_records", String.class))
            .isEqualTo("Ana Q");
        jdbc.execute("DROP SCHEMA " + schema + " CASCADE");
    }

    @Test
    void aborts_without_changing_the_schema_or_showing_the_value_when_a_record_keeps_data() {
        JdbcTemplate jdbc = new JdbcTemplate(dataSource);
        String schema = "v25_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        flyway(schema, "24").migrate();
        long author = author(jdbc, schema);
        jdbc.update("INSERT INTO " + schema + ".orthodontic_records (author_id, record_number, patient_name, document_type, "
            + "document_number, search_text, content) VALUES (?, 'AEO-0002', 'Luis', 'DNI', '74125896', 'luis', "
            + "CAST('{}' AS jsonb))", author);

        assertThatThrownBy(() -> flyway(schema, "25").migrate())
            .hasMessageContaining("1 historias conservan datos")
            .satisfies(e -> assertThat(String.valueOf(e.getMessage()) + stack(e)).doesNotContain("74125896"));

        assertThat(columns(jdbc, schema)).containsAll(RETIRED);
        jdbc.execute("DROP SCHEMA " + schema + " CASCADE");
    }

    @Test
    void aborts_when_only_the_old_signature_names_remain() {
        JdbcTemplate jdbc = new JdbcTemplate(dataSource);
        String schema = "v25_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        flyway(schema, "24").migrate();
        long author = author(jdbc, schema);
        jdbc.update("INSERT INTO " + schema + ".orthodontic_records (author_id, record_number, patient_name, "
            + "legacy_signatures, search_text, content) VALUES (?, 'AEO-0003', 'Rosa', "
            + "CAST('{\"guardianName\":\"Rosa Mamani\"}' AS jsonb), 'rosa', CAST('{}' AS jsonb))", author);

        assertThatThrownBy(() -> flyway(schema, "25").migrate())
            .hasMessageContaining("conservan datos")
            .satisfies(e -> assertThat(String.valueOf(e.getMessage()) + stack(e)).doesNotContain("Rosa Mamani"));

        assertThat(columns(jdbc, schema)).contains("legacy_signatures");
        jdbc.execute("DROP SCHEMA " + schema + " CASCADE");
    }

    private static String stack(Throwable e) {
        StringBuilder all = new StringBuilder();
        for (Throwable t = e; t != null; t = t.getCause()) {
            all.append(t.getMessage()).append('\n');
        }
        return all.toString();
    }
}

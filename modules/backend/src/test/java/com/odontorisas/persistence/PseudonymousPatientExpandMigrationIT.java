package com.odontorisas.persistence;

import com.odontorisas.AbstractIntegrationTest;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationVersion;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import javax.sql.DataSource;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * V21 (expansión de update-orthodontic-records-pseudonymous-patient) en un schema propio migrado
 * hasta V20: añade {@code patient_age} (0 a 99, opcional) e {@code identity_migrated_at} sin
 * renombrar, borrar ni cambiar ninguna columna de identidad ni su contenido, para poder volver al
 * binario anterior hasta el retiro.
 */
@SpringBootTest
class PseudonymousPatientExpandMigrationIT extends AbstractIntegrationTest {

    @Autowired DataSource dataSource;

    private Flyway flyway(String schema, String target) {
        return Flyway.configure().dataSource(dataSource).schemas(schema).defaultSchema(schema).createSchemas(true)
            .locations("classpath:db/migration").target(MigrationVersion.fromVersion(target)).load();
    }

    @Test
    void expansion_adds_the_new_columns_and_keeps_every_existing_value() {
        JdbcTemplate jdbc = new JdbcTemplate(dataSource);
        String schema = "v21_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        flyway(schema, "20").migrate();
        long author = jdbc.queryForObject("INSERT INTO " + schema + ".users (email, password_hash, role, full_name) "
            + "VALUES (?, 'h', 'USER', 'Dra. Torres') RETURNING id", Long.class, "v21-" + UUID.randomUUID() + "@empresa.test");
        long id = jdbc.queryForObject("INSERT INTO " + schema + ".orthodontic_records "
            + "(author_id, record_number, patient_name, document_type, document_number, patient_sex, birth_date, "
            + "birth_place, address, phone, search_text, content) "
            + "VALUES (?, 'AEO-0001', 'Ana Quispe', 'DNI', '74125896', 'FEMALE', DATE '2012-05-20', 'Lima', "
            + "'Av. Sol 123', '987654321', 'ana quispe 74125896 aeo-0001', CAST('{\"schemaVersion\":11}' AS jsonb)) RETURNING id",
            Long.class, author);

        flyway(schema, "21").migrate();

        Map<String, Object> row = jdbc.queryForMap("SELECT * FROM " + schema + ".orthodontic_records WHERE id = ?", id);
        assertThat(row).containsEntry("patient_name", "Ana Quispe").containsEntry("document_number", "74125896")
            .containsEntry("address", "Av. Sol 123").containsEntry("phone", "987654321")
            .containsEntry("birth_place", "Lima").containsEntry("document_type", "DNI");
        assertThat(row.get("patient_age")).isNull();
        assertThat(row.get("identity_migrated_at")).isNull();
        assertThat(row.get("content").toString()).contains("\"schemaVersion\": 11");

        jdbc.update("UPDATE " + schema + ".orthodontic_records SET patient_age = 0 WHERE id = ?", id);
        jdbc.update("UPDATE " + schema + ".orthodontic_records SET patient_age = 99 WHERE id = ?", id);
        assertThatThrownBy(() -> jdbc.update("UPDATE " + schema + ".orthodontic_records SET patient_age = 100 WHERE id = ?", id))
            .hasMessageContaining("ck_orthodontic_records_patient_age");
        assertThatThrownBy(() -> jdbc.update("UPDATE " + schema + ".orthodontic_records SET patient_age = -1 WHERE id = ?", id))
            .hasMessageContaining("ck_orthodontic_records_patient_age");

        jdbc.execute("DROP SCHEMA " + schema + " CASCADE");
    }

    @Test
    void v22_keeps_the_original_name_and_the_signature_names_for_the_copy() {
        JdbcTemplate jdbc = new JdbcTemplate(dataSource);
        String schema = "v22_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        flyway(schema, "21").migrate();
        long author = jdbc.queryForObject("INSERT INTO " + schema + ".users (email, password_hash, role, full_name) "
            + "VALUES (?, 'h', 'USER', 'Dra. Torres') RETURNING id", Long.class, "v22-" + UUID.randomUUID() + "@empresa.test");
        long withNames = jdbc.queryForObject("INSERT INTO " + schema + ".orthodontic_records "
            + "(author_id, record_number, patient_name, search_text, content) VALUES (?, 'AEO-0001', 'Ana Quispe', 'x', "
            + "CAST('{\"signatures\":{\"guardianName\":\"Rosa Mamani\",\"guardianRelationship\":\"Madre\",\"supervisor1Name\":\"Dr. Medina\"}}' AS jsonb)) RETURNING id",
            Long.class, author);
        long withoutSignatures = jdbc.queryForObject("INSERT INTO " + schema + ".orthodontic_records "
            + "(author_id, record_number, patient_name, search_text, content) VALUES (?, 'AEO-0002', 'Luis Rojas', 'y', "
            + "CAST('{}' AS jsonb)) RETURNING id", Long.class, author);

        flyway(schema, "22").migrate();

        Map<String, Object> first = jdbc.queryForMap("SELECT legacy_patient_name, legacy_signatures::text AS sig FROM "
            + schema + ".orthodontic_records WHERE id = ?", withNames);
        assertThat(first.get("legacy_patient_name")).isEqualTo("Ana Quispe");
        // Solo los tres nombres retirados; el supervisor no es un dato del paciente.
        assertThat(first.get("sig").toString()).contains("guardianName").contains("Rosa Mamani").contains("Madre")
            .doesNotContain("Dr. Medina");
        Map<String, Object> second = jdbc.queryForMap("SELECT legacy_patient_name, legacy_signatures FROM "
            + schema + ".orthodontic_records WHERE id = ?", withoutSignatures);
        assertThat(second.get("legacy_patient_name")).isEqualTo("Luis Rojas");
        assertThat(second.get("legacy_signatures")).isNull();

        jdbc.execute("DROP SCHEMA " + schema + " CASCADE");
    }
}

package com.odontorisas.service.records.migration;

import com.odontorisas.AbstractIntegrationTest;
import com.odontorisas.TestRecordNumbers;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.PrintStream;
import java.io.StringReader;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Acción administrativa única de migración (update-orthodontic-records-pseudonymous-patient, D8) de
 * punta a punta sobre PostgreSQL. La fecha límite es 2026-10-20 y el reloj de la app es mutable para
 * correr antes y después de ella.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(IdentityMigrationIT.MutableClockConfig.class)
@TestPropertySource(properties = "app.legacy-copy.deadline=2026-10-20T00:00:00Z")
class IdentityMigrationIT extends AbstractIntegrationTest {

    static final Instant OPEN = Instant.parse("2026-10-05T15:00:00Z");
    static final Instant CLOSED = Instant.parse("2026-10-25T15:00:00Z");
    static final MutableClock CLOCK = new MutableClock(CLOSED);

    static final class MutableClock extends Clock {
        private volatile Instant now;

        MutableClock(Instant now) {
            this.now = now;
        }

        void set(Instant instant) {
            this.now = instant;
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }

    @TestConfiguration
    static class MutableClockConfig {
        @Bean
        @Primary
        Clock mutableClock() {
            return CLOCK;
        }
    }

    @Autowired IdentityMigration migration;
    @Autowired JdbcTemplate jdbc;
    @Autowired MockMvc mockMvc;
    @Autowired ConfigurableApplicationContext context;

    private final JsonMapper json = JsonMapper.builder().build();

    @BeforeEach
    void setUp() {
        CLOCK.set(CLOSED);
        // Estos tests migran todo lo pendiente: se parte de una base sin historias sin migrar de otros tests.
        jdbc.update("UPDATE orthodontic_records SET identity_migrated_at = COALESCE(identity_migrated_at, now()), document_type = NULL, document_number = NULL, "
            + "birth_date = NULL, birth_place = NULL, address = NULL, phone = NULL, legacy_patient_name = NULL, "
            + "legacy_signatures = NULL, content = content #- '{signatures,patientSignatureName}' "
            + "#- '{signatures,guardianName}' #- '{signatures,guardianRelationship}', "
            + "unlock_request_reason = CASE WHEN unlock_request_reason IN ('ALIAS','SEXO','EDAD','OTRO') "
            + "THEN unlock_request_reason WHEN unlock_request_reason IS NULL THEN NULL ELSE 'OTRO' END "
            + "WHERE document_type IS NOT NULL OR document_number IS NOT NULL OR birth_date IS NOT NULL OR birth_place IS NOT NULL "
            + "OR address IS NOT NULL OR phone IS NOT NULL OR legacy_patient_name IS NOT NULL OR legacy_signatures IS NOT NULL "
            + "OR identity_migrated_at IS NULL OR jsonb_exists(content -> 'signatures', 'guardianName') "
            + "OR jsonb_exists(content -> 'signatures', 'patientSignatureName') "
            + "OR jsonb_exists(content -> 'signatures', 'guardianRelationship') "
            + "OR unlock_request_reason NOT IN ('ALIAS','SEXO','EDAD','OTRO')");
        jdbc.update("UPDATE record_unlock_events SET reason = 'OTRO' WHERE reason IS NOT NULL "
            + "AND reason NOT IN ('ALIAS','SEXO','EDAD','OTRO')");
    }

    private long author() {
        return jdbc.queryForObject("INSERT INTO users (email, password_hash, role, full_name) VALUES (?, 'h', 'USER', "
            + "'Dra. Torres') RETURNING id", Long.class, "mig-" + UUID.randomUUID() + "@empresa.test");
    }

    /** Historia con identidad en claro, como las que existían antes del cambio. */
    private long legacy(long author, String name, String birthDate, String start, String content) {
        long id = jdbc.queryForObject("INSERT INTO orthodontic_records (author_id, record_number, patient_name, "
            + "legacy_patient_name, document_type, document_number, birth_date, birth_place, address, phone, "
            + "treatment_start_date, search_text, content) VALUES (?, ?, ?, ?, 'DNI', '74125896', CAST(? AS date), 'Lima', "
            + "'Av. Sol 123', '987654321', CAST(? AS date), 'x', CAST(? AS jsonb)) RETURNING id",
            Long.class, author, TestRecordNumbers.next(), name, name, birthDate, start, content);
        return id;
    }

    private Integer age(long id) {
        Object age = row(id).get("patient_age");
        return age == null ? null : ((Number) age).intValue();
    }

    private Map<String, Object> row(long id) {
        return jdbc.queryForMap("SELECT * FROM orthodontic_records WHERE id = ?", id);
    }

    private static final String SIGNATURES = "{\"signatures\":{\"patientSignatureName\":\"Ana Quispe\","
        + "\"guardianName\":\"Rosa Mamani\",\"guardianRelationship\":\"Madre\",\"supervisor1Name\":\"Dr. Medina\","
        + "\"supervisor2Name\":\"Dra. Rojas\",\"treatingSignatureName\":\"Dra. Torres\"}}";

    @Test
    void a_correct_migration_sets_alias_and_age_and_deletes_the_retired_data() {
        long author = author();
        long id = legacy(author, "Ana Quispe", "2012-05-20", "2026-05-19", SIGNATURES);

        IdentityMigration.Result result = migration.migrate();

        assertThat(result.migrated()).isEqualTo(1);
        Map<String, Object> row = row(id);
        assertThat(row.get("patient_name")).isEqualTo("Ana Q");
        assertThat(((Number) row.get("patient_age")).intValue()).isEqualTo(13);
        for (String column : List.of("document_type", "document_number", "birth_date", "birth_place", "address", "phone",
            "legacy_patient_name", "legacy_signatures")) {
            assertThat(row.get(column)).as(column).isNull();
        }
        assertThat(row.get("search_text").toString()).isEqualTo("ana q " + row.get("record_number").toString().toLowerCase());
        assertThat(row.get("identity_migrated_at")).isNotNull();
        // Solo se borran los nombres del paciente y del apoderado; supervisores y tratante se conservan.
        String content = row.get("content").toString();
        assertThat(content).doesNotContain("patientSignatureName").doesNotContain("guardianName")
            .doesNotContain("guardianRelationship").doesNotContain("Rosa Mamani")
            .contains("Dr. Medina").contains("Dra. Rojas").contains("Dra. Torres");
        assertThat(migration.verify().clean()).isTrue();
    }

    @Test
    void without_a_birth_date_the_age_stays_empty() {
        long id = legacy(author(), "Luis Rojas", null, null, "{}");
        migration.migrate();
        assertThat(age(id)).isNull();
        assertThat(row(id).get("patient_name")).isEqualTo("Luis R");
    }

    @Test
    void every_kind_of_name_gets_a_valid_alias() {
        long author = author();
        Map<String, String> expected = Map.of("", "Paciente", "   ", "Paciente", "Ana", "Ana",
            "de la Cruz Rojas", "Cruz R", "María José Quispe", "María J");
        Map<String, Long> ids = new java.util.LinkedHashMap<>();
        expected.keySet().forEach(name -> ids.put(name, legacy(author, name, null, null, "{}")));

        migration.migrate();

        expected.forEach((name, alias) -> assertThat(row(ids.get(name)).get("patient_name")).as("«" + name + "»").isEqualTo(alias));
    }

    @Test
    void an_alias_the_author_already_wrote_is_kept_and_so_is_the_age() {
        long author = author();
        long id = legacy(author, "Ana Lucía Quispe Mamani", "2012-05-20", "2026-05-19", "{}");
        jdbc.update("UPDATE orthodontic_records SET patient_name = 'Anita', patient_age = 14 WHERE id = ?", id);

        migration.migrate();

        assertThat(row(id).get("patient_name")).isEqualTo("Anita");
        assertThat(age(id)).isEqualTo(14);
        assertThat(row(id).get("legacy_patient_name")).isNull();
    }

    @Test
    void rerunning_after_an_interruption_skips_the_migrated_ones_and_ends_the_same() {
        long author = author();
        long first = legacy(author, "Ana Quispe", "2012-05-20", "2026-05-19", "{}");
        long second = legacy(author, "Luis Rojas", null, null, "{}");
        long third = legacy(author, "Rosa Díaz", "2010-01-01", "2026-05-19", "{}");

        IdentityMigration.Result partial = migration.migrate(1);
        assertThat(partial.migrated()).isEqualTo(1);
        assertThat(partial.remaining()).isEqualTo(2);
        assertThat(row(first).get("identity_migrated_at")).isNotNull();
        assertThat(row(second).get("identity_migrated_at")).isNull();

        IdentityMigration.Result rest = migration.migrate();
        assertThat(rest.migrated()).isEqualTo(2);
        assertThat(rest.remaining()).isZero();
        assertThat(migration.migrate().migrated()).isZero();

        assertThat(row(first).get("patient_name")).isEqualTo("Ana Q");
        assertThat(age(second)).isNull();   // sin nacimiento: sigue vacía, no se recalcula
        assertThat(age(third)).isEqualTo(16);
        assertThat(migration.verify().clean()).isTrue();
    }

    @Test
    void free_text_unlock_reasons_become_otro_keeping_their_dates_and_actions() {
        long author = author();
        long id = legacy(author, "Ana Quispe", null, null, "{}");
        jdbc.update("UPDATE orthodontic_records SET patient_locked_at = now(), unlock_requested_at = TIMESTAMPTZ '2026-10-02 10:00+00', "
            + "unlock_request_reason = 'Error en el DNI 74125896' WHERE id = ?", id);
        long admin = author();
        jdbc.update("INSERT INTO record_unlock_events (record_id, admin_id, action, reason, created_at) VALUES "
            + "(?, ?, 'UNLOCKED', 'Nombre mal escrito', TIMESTAMPTZ '2026-10-03 10:00+00'), "
            + "(?, ?, 'DISCARDED', 'ALIAS', TIMESTAMPTZ '2026-10-04 10:00+00')", id, admin, id, admin);

        migration.migrate();

        Map<String, Object> row = row(id);
        assertThat(row.get("unlock_request_reason")).isEqualTo("OTRO");
        assertThat(row.get("unlock_requested_at")).isNotNull();   // la solicitud sigue pendiente
        assertThat(row.get("patient_locked_at")).isNotNull();     // el candado se conserva
        List<Map<String, Object>> events = jdbc.queryForList("SELECT action, reason, created_at FROM record_unlock_events "
            + "WHERE record_id = ? ORDER BY created_at", id);
        assertThat(events).extracting(e -> e.get("action")).containsExactly("UNLOCKED", "DISCARDED");
        assertThat(events).extracting(e -> e.get("reason")).containsExactly("OTRO", "ALIAS");
        assertThat(migration.verify().rowsWithFreeTextUnlockReasons()).isZero();
    }

    @Test
    void it_refuses_to_run_before_the_deadline_or_without_one() {
        long id = legacy(author(), "Ana Quispe", "2012-05-20", "2026-05-19", SIGNATURES);
        CLOCK.set(OPEN);

        assertThatThrownBy(() -> migration.migrate()).isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("aún no venció");
        assertThat(row(id).get("identity_migrated_at")).isNull();
        assertThat(row(id).get("document_number")).isEqualTo("74125896");
    }

    @Test
    void records_born_after_the_change_are_only_marked() {
        long author = author();
        long id = jdbc.queryForObject("INSERT INTO orthodontic_records (author_id, record_number, patient_name, patient_age, "
            + "search_text, content) VALUES (?, ?, 'Mateo', 13, 'mateo', CAST('{}' AS jsonb)) RETURNING id", Long.class,
            author, TestRecordNumbers.next());

        migration.migrate();

        assertThat(row(id).get("patient_name")).isEqualTo("Mateo");
        assertThat(age(id)).isEqualTo(13);
        assertThat(row(id).get("identity_migrated_at")).isNotNull();
    }

    // --- Compuertas del operador (IdentityMigrationRunner) ---

    private record Run(int code, String output) {
    }

    private Run run(String mode, boolean backup, String approval, String typed) {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        IdentityMigrationRunner runner = new IdentityMigrationRunner(migration, context, mode, backup, approval,
            new PrintStream(bytes, true, StandardCharsets.UTF_8), new BufferedReader(new StringReader(typed)));
        int code = runner.execute();
        return new Run(code, bytes.toString(StandardCharsets.UTF_8));
    }

    @Test
    void apply_changes_nothing_without_a_verified_backup_an_approval_or_the_typed_confirmation() {
        long id = legacy(author(), "Ana Quispe", "2012-05-20", "2026-05-19", SIGNATURES);
        String pending = String.valueOf(migration.pendingCount());

        Run noBackup = run("apply", false, "aprobación", "MIGRAR " + pending + "\n");
        Run noApproval = run("apply", true, " ", "MIGRAR " + pending + "\n");
        Run wrongWord = run("apply", true, "aprobación", "migrar\n");
        Run noInput = run("apply", true, "aprobación", "");

        for (Run refused : List.of(noBackup, noApproval, wrongWord, noInput)) {
            assertThat(refused.code()).isEqualTo(2);
            assertThat(refused.output()).contains("NO SE MIGRÓ NADA");
        }
        assertThat(row(id).get("identity_migrated_at")).isNull();
        assertThat(row(id).get("document_number")).isEqualTo("74125896");
    }

    @Test
    void list_shows_the_aliases_without_changing_anything() {
        long id = legacy(author(), "Ana Quispe", "2012-05-20", "2026-05-19", SIGNATURES);

        Run listed = run("list", false, "", "");

        assertThat(listed.code()).isZero();
        assertThat(listed.output()).contains("Ana Q").contains("Nada se cambió");
        assertThat(listed.output()).doesNotContain("Quispe").doesNotContain("74125896").doesNotContain("Av. Sol");
        assertThat(row(id).get("identity_migrated_at")).isNull();
    }

    @Test
    void apply_with_everything_in_order_migrates_and_reports_only_counts() {
        long id = legacy(author(), "Ana Quispe", "2012-05-20", "2026-05-19", SIGNATURES);
        String pending = String.valueOf(migration.pendingCount());

        Run done = run("apply", true, "aprobación escrita del 2026-12-10", "MIGRAR " + pending + "\n");

        assertThat(done.code()).isZero();
        assertThat(done.output()).contains("Migradas: " + pending).contains("Verificación: historias con columnas retiradas con valor: 0")
            .doesNotContain("Quispe").doesNotContain("74125896");
        assertThat(row(id).get("patient_name")).isEqualTo("Ana Q");
    }

    // --- Historias inconsistentes ---

    /** Scenario "Historia migrada con datos clínicos inconsistentes". */
    @Test
    void an_inconsistent_record_is_reported_and_its_next_save_is_rejected_until_corrected() throws Exception {
        String email = "mig-" + UUID.randomUUID() + "@empresa.test";
        MvcResult registered = mockMvc.perform(post("/auth/register").contentType(MediaType.APPLICATION_JSON)
            .content("{\"email\":\"" + email + "\",\"password\":\"password123\",\"fullName\":\"Dra. Torres\"}"))
            .andExpect(status().isCreated()).andReturn();
        JsonNode session = json.readTree(registered.getResponse().getContentAsString(StandardCharsets.UTF_8));
        long author = session.get("user").get("id").asLong();
        String token = session.get("accessToken").stringValue();
        // Edad calculada 7 al migrar (2019-06-01 → 2026-10-01) con la primera menstruación ya guardada a los 8 años.
        String content = "{\"anamnesis\":{\"menarche\":\"YES\",\"menarcheAge\":8}}";
        long id = legacy(author, "Ana Quispe", "2019-06-01", "2026-10-01", content);
        jdbc.update("UPDATE orthodontic_records SET patient_sex = 'FEMALE' WHERE id = ?", id);
        int before = migration.inconsistentCount();

        migration.migrate();

        assertThat(age(id)).isEqualTo(7);
        assertThat(migration.inconsistentCount()).isEqualTo(before + 1);

        JsonNode record = json.readTree(mockMvc.perform(get("/api/orthodontic-records/" + id)
            .header("Authorization", "Bearer " + token)).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8));
        String body = "{\"version\":" + record.get("version").asLong() + ",\"recordNumber\":\"" + record.get("recordNumber").stringValue()
            + "\",\"patientAlias\":\"Ana Q\",\"aliasConfirmed\":null,\"patientSex\":\"FEMALE\",\"patientAge\":7,"
            + "\"content\":{\"anamnesis\":{\"menarche\":\"YES\",\"menarcheAge\":8}}}";
        MvcResult rejected = mockMvc.perform(put("/api/orthodontic-records/" + id).header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON).content(body.replace("\"aliasConfirmed\":null,", ""))).andReturn();
        assertThat(rejected.getResponse().getStatus()).isEqualTo(400);
        assertThat(rejected.getResponse().getContentAsString(StandardCharsets.UTF_8)).contains("content.anamnesis.menarcheAge");

        // Corregida (la edad real es 9), se guarda.
        MvcResult fixed = mockMvc.perform(put("/api/orthodontic-records/" + id).header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON).content(body.replace("\"patientAge\":7", "\"patientAge\":9")
                .replace("\"aliasConfirmed\":null,", ""))).andReturn();
        assertThat(fixed.getResponse().getStatus()).isEqualTo(200);
    }
}

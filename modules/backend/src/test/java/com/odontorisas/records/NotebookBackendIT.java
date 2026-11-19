package com.odontorisas.records;

import com.odontorisas.AbstractIntegrationTest;
import com.odontorisas.TestRecordNumbers;
import com.odontorisas.service.records.migration.IdentityMigration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Parte del backend de la libreta local (add-orthodontic-records-local-patient-notebook): búsqueda por
 * identificadores (sin texto ni ids en la URL, mismo acceso por rol y sin caché), marca de respaldo del
 * autor (idempotente, solo el autor y solo en la ventana de copia) y su informe por autor para el responsable.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ExtendWith(OutputCaptureExtension.class)
@Import(NotebookBackendIT.MutableClockConfig.class)
@TestPropertySource(properties = "app.legacy-copy.deadline=2026-10-20T00:00:00Z")
class NotebookBackendIT extends AbstractIntegrationTest {

    static final Instant BEFORE = Instant.parse("2026-10-05T15:00:00Z");
    static final Instant AFTER = Instant.parse("2026-10-20T00:00:01Z");
    static final MutableClock CLOCK = new MutableClock(BEFORE);

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

    private static final String PASSWORD = "password123";
    private static final String BASE = "/api/orthodontic-records";

    @Autowired MockMvc mockMvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired IdentityMigration migration;

    private final JsonMapper json = JsonMapper.builder().build();

    record Session(long id, String token) {}

    @BeforeEach
    void resetClock() {
        CLOCK.set(BEFORE);
    }

    private JsonNode read(MvcResult result) throws Exception {
        String body = result.getResponse().getContentAsString(StandardCharsets.UTF_8);
        return body.isEmpty() ? null : json.readTree(body);
    }

    private Session register(String fullName) throws Exception {
        String email = "nb-" + UUID.randomUUID() + "@empresa.test";
        MvcResult result = mockMvc.perform(post("/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"password\":\"" + PASSWORD + "\",\"fullName\":\"" + fullName + "\"}"))
            .andExpect(status().isCreated()).andReturn();
        JsonNode node = read(result);
        return new Session(node.get("user").get("id").asLong(), node.get("accessToken").stringValue());
    }

    private Session withRole(String fullName, String role) throws Exception {
        Session user = register(fullName);
        String email = jdbc.queryForObject("SELECT email FROM users WHERE id = ?", String.class, user.id());
        jdbc.update("UPDATE users SET role = ? WHERE id = ?", role, user.id());
        MvcResult login = mockMvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON)
            .content("{\"email\":\"" + email + "\",\"password\":\"" + PASSWORD + "\"}")).andReturn();
        return new Session(user.id(), read(login).get("accessToken").stringValue());
    }

    private long record(Session author, String alias) throws Exception {
        MvcResult created = mockMvc.perform(post(BASE).header("Authorization", "Bearer " + author.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"recordNumber\":\"" + TestRecordNumbers.next() + "\",\"patientAlias\":\"" + alias + "\"}"))
            .andExpect(status().isCreated()).andReturn();
        return read(created).get("id").asLong();
    }

    private MvcResult searchIds(Session as, String idsJson) throws Exception {
        return mockMvc.perform(post(BASE + "/search").header("Authorization", "Bearer " + as.token())
            .contentType(MediaType.APPLICATION_JSON).content("{\"recordIds\":" + idsJson + "}")).andReturn();
    }

    private MvcResult backup(Session as, long id) throws Exception {
        return mockMvc.perform(post(BASE + "/" + id + "/notebook-backup").header("Authorization", "Bearer " + as.token())).andReturn();
    }

    private List<Long> ids(MvcResult result) throws Exception {
        List<Long> found = new ArrayList<>();
        read(result).get("content").forEach(row -> found.add(row.get("id").asLong()));
        return found;
    }

    private Instant backedUpAt(long id) {
        var stamp = jdbc.queryForObject("SELECT notebook_backup_confirmed_at FROM orthodontic_records WHERE id = ?",
            java.sql.Timestamp.class, id);
        return stamp == null ? null : stamp.toInstant();
    }

    // --- Búsqueda por identificadores ---

    @Test
    void searching_by_ids_returns_only_what_the_role_can_reach_without_cache() throws Exception {
        Session torres = register("Dra. Torres");
        Session medina = register("Dr. Medina");
        long a1 = record(torres, "Ana");
        long a2 = record(torres, "Beto");
        long b1 = record(medina, "Carla");
        String all = "[" + a1 + "," + a2 + "," + b1 + "]";

        MvcResult asUser = searchIds(torres, all);
        assertThat(asUser.getResponse().getStatus()).isEqualTo(200);
        assertThat(asUser.getResponse().getHeader("Cache-Control")).contains("no-store");
        assertThat(ids(asUser)).containsExactlyInAnyOrder(a1, a2);   // la de otro tratante no aparece

        assertThat(ids(searchIds(withRole("Admin FACOP", "ADMIN"), all))).containsExactlyInAnyOrder(a1, a2, b1);
        assertThat(ids(searchIds(torres, "[" + b1 + "]"))).isEmpty();
        assertThat(ids(searchIds(torres, "[]"))).isEmpty();
        assertThat(ids(searchIds(torres, "[999999999]"))).isEmpty();
    }

    @Test
    void the_order_is_the_normal_one_most_recently_modified_first() throws Exception {
        Session torres = register("Dra. Torres");
        long older = record(torres, "Ana");
        long newer = record(torres, "Beto");
        jdbc.update("UPDATE orthodontic_records SET updated_at = now() - interval '2 days' WHERE id = ?", older);

        assertThat(ids(searchIds(torres, "[" + older + "," + newer + "]"))).containsExactly(newer, older);
    }

    @Test
    void more_than_50_ids_or_text_and_ids_together_are_400() throws Exception {
        Session torres = register("Dra. Torres");
        String fiftyOne = java.util.stream.IntStream.rangeClosed(1, 51).mapToObj(String::valueOf).collect(java.util.stream.Collectors.joining(","));

        assertThat(searchIds(torres, "[" + fiftyOne + "]").getResponse().getStatus()).isEqualTo(400);
        MvcResult both = mockMvc.perform(post(BASE + "/search").header("Authorization", "Bearer " + torres.token())
            .contentType(MediaType.APPLICATION_JSON).content("{\"q\":\"ana\",\"recordIds\":[1]}")).andReturn();
        assertThat(both.getResponse().getStatus()).isEqualTo(400);
    }

    @Test
    void the_ids_and_the_alias_never_reach_the_logs(CapturedOutput output) throws Exception {
        Session torres = register("Dra. Torres");
        long id = record(torres, "Zzmarcador");
        searchIds(torres, "[" + id + "]");
        mockMvc.perform(post(BASE + "/search").header("Authorization", "Bearer " + torres.token())
            .contentType(MediaType.APPLICATION_JSON).content("{\"q\":\"zzmarcador\"}")).andReturn();

        assertThat(output.getAll()).doesNotContain("recordIds").doesNotContain("Zzmarcador").doesNotContain("zzmarcador");
    }

    // --- Marca de respaldo ---

    @Test
    void the_author_marks_the_backup_and_marking_again_changes_nothing() throws Exception {
        Session torres = register("Dra. Torres");
        long id = record(torres, "Ana");
        long versionBefore = jdbc.queryForObject("SELECT version FROM orthodontic_records WHERE id = ?", Long.class, id);

        MvcResult first = backup(torres, id);
        assertThat(first.getResponse().getStatus()).isEqualTo(204);
        assertThat(first.getResponse().getHeader("Cache-Control")).contains("no-store");
        Instant stamp = backedUpAt(id);
        assertThat(stamp).isEqualTo(BEFORE);

        CLOCK.set(BEFORE.plusSeconds(3600));
        assertThat(backup(torres, id).getResponse().getStatus()).isEqualTo(204);
        assertThat(backedUpAt(id)).isEqualTo(stamp);   // idempotente: no se vuelve a marcar
        assertThat(jdbc.queryForObject("SELECT version FROM orthodontic_records WHERE id = ?", Long.class, id)).isEqualTo(versionBefore);
    }

    @Test
    void only_the_author_can_mark_it() throws Exception {
        Session torres = register("Dra. Torres");
        long id = record(torres, "Ana");

        assertThat(backup(register("Dr. Medina"), id).getResponse().getStatus()).isEqualTo(404);
        assertThat(backup(withRole("Admin FACOP", "ADMIN"), id).getResponse().getStatus()).isEqualTo(404);
        assertThat(backup(withRole("Coordinadora", "COORDINATOR"), id).getResponse().getStatus()).isIn(403, 404);
        assertThat(backedUpAt(id)).isNull();
    }

    @Test
    void it_closes_at_the_deadline_and_when_the_record_is_migrated() throws Exception {
        Session torres = register("Dra. Torres");
        long open = record(torres, "Ana");
        long migrated = record(torres, "Beto");
        jdbc.update("UPDATE orthodontic_records SET identity_migrated_at = now() WHERE id = ?", migrated);

        assertThat(backup(torres, migrated).getResponse().getStatus()).isEqualTo(404);
        CLOCK.set(AFTER);
        assertThat(backup(torres, open).getResponse().getStatus()).isEqualTo(404);
        assertThat(backedUpAt(open)).isNull();
        assertThat(backedUpAt(migrated)).isNull();
    }

    @Test
    void the_report_counts_pending_records_without_backup_by_author_and_shows_no_patient_values() throws Exception {
        Session torres = register("Dra. Torres");
        long backedUp = record(torres, "Ana");
        long pendingOne = record(torres, "Beto");
        long pendingTwo = record(torres, "Carla");
        jdbc.update("UPDATE orthodontic_records SET identity_migrated_at = now(), notebook_backup_confirmed_at = NULL "
            + "WHERE identity_migrated_at IS NULL AND author_id <> ?", torres.id());
        backup(torres, backedUp);

        var report = migration.unbackedByAuthor().orElseThrow();

        assertThat(report).filteredOn(row -> row.authorId() == torres.id()).singleElement()
            .satisfies(row -> assertThat(row.records()).isEqualTo(2));
        assertThat(report.toString()).doesNotContain("Ana").doesNotContain("Beto").doesNotContain("Carla");
        assertThat(pendingOne).isNotEqualTo(pendingTwo);
    }
}

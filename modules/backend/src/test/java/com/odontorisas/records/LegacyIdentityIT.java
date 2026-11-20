package com.odontorisas.records;

import com.odontorisas.AbstractIntegrationTest;
import com.odontorisas.TestRecordNumbers;
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
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Copia de los datos antiguos del paciente (update-orthodontic-records-pseudonymous-patient, D8): solo
 * el autor, hasta la fecha límite {@code app.legacy-copy.deadline} y mientras la historia no se migre,
 * con {@code Cache-Control: no-store} y sin que el cuerpo llegue a los registros. El reloj de la app
 * es mutable para cruzar la fecha límite.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ExtendWith(OutputCaptureExtension.class)
@Import(LegacyIdentityIT.MutableClockConfig.class)
@TestPropertySource(properties = "app.legacy-copy.deadline=2026-10-20T00:00:00Z")
class LegacyIdentityIT extends AbstractIntegrationTest {

    static final Instant BEFORE = Instant.parse("2026-10-05T15:00:00Z");
    static final Instant AFTER = Instant.parse("2026-10-20T00:00:01Z");
    static final MutableClock CLOCK = new MutableClock(BEFORE);

    /** Reloj que los tests pueden adelantar. */
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
    private static final String REAL_NAME = "Ana Lucía Quispe Mamani";
    private static final String DNI = "74125896";

    @Autowired MockMvc mockMvc;
    @Autowired JdbcTemplate jdbc;

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
        String email = "legacy-" + UUID.randomUUID() + "@empresa.test";
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

    /** Historia con datos antiguos en las columnas retiradas, como las que existían antes del cambio. */
    private long legacyRecord(Session author) throws Exception {
        MvcResult created = mockMvc.perform(post(BASE).header("Authorization", "Bearer " + author.token())
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"recordNumber\":\"" + TestRecordNumbers.next() + "\",\"patientAlias\":\"Ana\"}"))
            .andExpect(status().isCreated()).andReturn();
        long id = read(created).get("id").asLong();
        jdbc.update("UPDATE orthodontic_records SET legacy_patient_name = ?, document_type = 'DNI', document_number = ?, "
            + "birth_date = DATE '2012-05-20', birth_place = 'Lima', address = 'Av. Sol 123', phone = '987654321', "
            + "legacy_signatures = CAST('{\"guardianName\":\"Rosa Mamani\",\"guardianRelationship\":\"Madre\"}' AS jsonb) "
            + "WHERE id = ?", REAL_NAME, DNI, id);
        return id;
    }

    private MvcResult legacy(Session as, long id) throws Exception {
        return mockMvc.perform(get(BASE + "/" + id + "/legacy-identity").header("Authorization", "Bearer " + as.token()))
            .andReturn();
    }

    @Test
    void the_author_reads_the_legacy_identity_with_no_store() throws Exception {
        Session torres = register("Dra. Torres");
        long id = legacyRecord(torres);

        MvcResult result = legacy(torres, id);

        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        assertThat(result.getResponse().getHeader("Cache-Control")).contains("no-store");
        JsonNode body = read(result);
        assertThat(body.get("patientName").stringValue()).isEqualTo(REAL_NAME);
        assertThat(body.get("documentType").stringValue()).isEqualTo("DNI");
        assertThat(body.get("documentNumber").stringValue()).isEqualTo(DNI);
        assertThat(body.get("birthDate").stringValue()).isEqualTo("2012-05-20");
        assertThat(body.get("birthPlace").stringValue()).isEqualTo("Lima");
        assertThat(body.get("address").stringValue()).isEqualTo("Av. Sol 123");
        assertThat(body.get("phone").stringValue()).isEqualTo("987654321");
        assertThat(body.get("guardianName").stringValue()).isEqualTo("Rosa Mamani");
        assertThat(body.get("guardianRelationship").stringValue()).isEqualTo("Madre");
        // La fecha límite viaja con los datos para que la pantalla avise del plazo.
        assertThat(body.get("copyDeadline").stringValue()).isEqualTo("2026-10-20T00:00:00Z");
    }

    @Test
    void another_user_an_admin_and_a_coordinator_get_no_data() throws Exception {
        Session torres = register("Dra. Torres");
        long id = legacyRecord(torres);

        for (Session other : new Session[] {register("Dr. Medina"), withRole("Admin FACOP", "ADMIN"),
            withRole("Coordinadora", "COORDINATOR")}) {
            MvcResult result = legacy(other, id);
            // La coordinación ni siquiera llega: el rol no admite la operación (403); los demás reciben 404.
            assertThat(result.getResponse().getStatus()).isIn(403, 404);
            assertThat(result.getResponse().getContentAsString(StandardCharsets.UTF_8)).doesNotContain(REAL_NAME).doesNotContain(DNI);
        }
    }

    @Test
    void an_admin_can_read_the_legacy_identity_of_a_record_it_authored() throws Exception {
        Session admin = withRole("Admin FACOP", "ADMIN");
        long id = legacyRecord(admin);
        assertThat(legacy(admin, id).getResponse().getStatus()).isEqualTo(200);
    }

    @Test
    void it_closes_at_the_deadline_and_when_the_record_is_migrated() throws Exception {
        Session torres = register("Dra. Torres");
        long open = legacyRecord(torres);
        long migrated = legacyRecord(torres);
        jdbc.update("UPDATE orthodontic_records SET identity_migrated_at = now() WHERE id = ?", migrated);

        assertThat(legacy(torres, open).getResponse().getStatus()).isEqualTo(200);
        assertThat(legacy(torres, migrated).getResponse().getStatus()).isEqualTo(404);

        CLOCK.set(AFTER);
        MvcResult closed = legacy(torres, open);
        assertThat(closed.getResponse().getStatus()).isEqualTo(404);
        assertThat(closed.getResponse().getContentAsString(StandardCharsets.UTF_8)).doesNotContain(REAL_NAME);
    }

    @Test
    void saving_the_alias_does_not_destroy_what_has_not_been_copied() throws Exception {
        Session torres = register("Dra. Torres");
        long id = legacyRecord(torres);
        JsonNode record = read(mockMvc.perform(get(BASE + "/" + id).header("Authorization", "Bearer " + torres.token())).andReturn());

        mockMvc.perform(put(BASE + "/" + id).header("Authorization", "Bearer " + torres.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"version\":" + record.get("version").asLong() + ",\"recordNumber\":\""
                    + record.get("recordNumber").stringValue() + "\",\"patientAlias\":\"Ana Q\"}"))
            .andExpect(status().isOk());

        assertThat(jdbc.queryForObject("SELECT patient_name FROM orthodontic_records WHERE id = ?", String.class, id)).isEqualTo("Ana Q");
        JsonNode body = read(legacy(torres, id));
        assertThat(body.get("patientName").stringValue()).isEqualTo(REAL_NAME);
        assertThat(body.get("documentNumber").stringValue()).isEqualTo(DNI);
        assertThat(body.get("guardianName").stringValue()).isEqualTo("Rosa Mamani");
    }

    @Test
    void the_legacy_values_never_reach_the_logs(CapturedOutput output) throws Exception {
        Session torres = register("Dra. Torres");
        long id = legacyRecord(torres);
        legacy(torres, id);
        legacy(register("Dr. Medina"), id);

        assertThat(output.getAll()).doesNotContain(REAL_NAME).doesNotContain(DNI).doesNotContain("Av. Sol 123");
    }
}

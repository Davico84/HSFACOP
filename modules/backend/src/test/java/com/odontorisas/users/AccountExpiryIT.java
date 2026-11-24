package com.odontorisas.users;

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
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

/**
 * Scenarios del vencimiento de cuentas (capacidades users, authentication, orthodontic-records y
 * dashboard) de punta a punta con PostgreSQL real. El reloj queda fijo el 15 de octubre de 2030 en Lima.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AccountExpiryIT.FixedClock.class)
class AccountExpiryIT extends AbstractIntegrationTest {

    static final ZoneId LIMA = ZoneId.of("America/Lima");
    static final Instant NOW = ZonedDateTime.of(2030, 10, 15, 12, 0, 0, 0, LIMA).toInstant();
    static final LocalDate TODAY = LocalDate.of(2030, 10, 15);

    @TestConfiguration
    static class FixedClock {
        @Bean
        @Primary
        Clock fixedClock() {
            return Clock.fixed(NOW, LIMA);
        }
    }

    private static final String PASSWORD = "password123";
    private static final String RECORDS = "/api/orthodontic-records";

    @Autowired MockMvc mockMvc;
    @Autowired JdbcTemplate jdbc;

    private final JsonMapper json = JsonMapper.builder().build();

    record Session(long id, String email, String token, JsonNode user) {}

    @BeforeEach
    void emptyTables() {
        jdbc.execute("TRUNCATE orthodontic_records, refresh_tokens, users RESTART IDENTITY CASCADE");
    }

    // --- Ayudas ---

    private JsonNode read(MvcResult result) throws Exception {
        return json.readTree(result.getResponse().getContentAsString(StandardCharsets.UTF_8));
    }

    private Session register(String extraJson) throws Exception {
        String email = "exp-" + UUID.randomUUID() + "@empresa.test";
        MvcResult result = mockMvc.perform(post("/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"password\":\"" + PASSWORD + "\",\"fullName\":\"Ana Pérez\"" + extraJson + "}"))
            .andReturn();
        assertThat(result.getResponse().getStatus()).isEqualTo(201);
        JsonNode node = read(result);
        return new Session(node.get("user").get("id").asLong(), email, node.get("accessToken").stringValue(), node.get("user"));
    }

    private Session user() throws Exception {
        return register("");
    }

    private Session login(Session s) throws Exception {
        MvcResult result = mockMvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON)
            .content("{\"email\":\"" + s.email() + "\",\"password\":\"" + PASSWORD + "\"}")).andReturn();
        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        JsonNode node = read(result);
        return new Session(s.id(), s.email(), node.get("accessToken").stringValue(), node.get("user"));
    }

    private Session admin() throws Exception {
        Session s = user();
        jdbc.update("UPDATE users SET role = 'ADMIN', expires_on = NULL WHERE id = ?", s.id());
        return login(s);
    }

    private void expiresOn(Session s, LocalDate date) {
        jdbc.update("UPDATE users SET expires_on = ? WHERE id = ?", date, s.id());
    }

    private LocalDate expiryOf(Session s) {
        return jdbc.queryForObject("SELECT expires_on FROM users WHERE id = ?", LocalDate.class, s.id());
    }

    private static String bearer(Session s) {
        return "Bearer " + s.token();
    }

    private long createRecord(Session as) throws Exception {
        MvcResult result = mockMvc.perform(post(RECORDS).header("Authorization", bearer(as))
            .contentType(MediaType.APPLICATION_JSON)
            .content(TestRecordNumbers.withNumber("{\"patientAlias\":\"Paciente\"}", TestRecordNumbers.next()))).andReturn();
        assertThat(result.getResponse().getStatus()).isEqualTo(201);
        return read(result).get("id").asLong();
    }

    private MvcResult createRecordRaw(Session as) throws Exception {
        return mockMvc.perform(post(RECORDS).header("Authorization", bearer(as))
            .contentType(MediaType.APPLICATION_JSON)
            .content(TestRecordNumbers.withNumber("{\"patientAlias\":\"Otro\"}", TestRecordNumbers.next()))).andReturn();
    }

    private MvcResult save(Session as, long id) throws Exception {
        JsonNode record = read(mockMvc.perform(get(RECORDS + "/" + id).header("Authorization", bearer(as))).andReturn());
        String body = "{\"version\":" + record.get("version").asLong() + ",\"recordNumber\":\""
            + record.get("recordNumber").stringValue() + "\",\"patientAlias\":\"Paciente\",\"patientSex\":\"FEMALE\","
            + "\"patientAge\":9,\"content\":{}}";
        return mockMvc.perform(put(RECORDS + "/" + id).header("Authorization", bearer(as))
            .contentType(MediaType.APPLICATION_JSON).content(body)).andReturn();
    }

    private MvcResult admin(String method, String path, Session as, String body) throws Exception {
        var req = method.equals("PUT") ? put(path) : post(path);
        req.header("Authorization", bearer(as));
        if (body != null) {
            req.contentType(MediaType.APPLICATION_JSON).content(body);
        }
        return mockMvc.perform(req).andReturn();
    }

    // --- users: vencimiento de la cuenta ---

    @Test
    void migration_formula_gives_registration_date_plus_12_months_in_lima() {
        // Alta el 2026-10-06 a las 23:30 en Lima (04:30 UTC del día 7): sigue siendo el día 6 en Lima.
        LocalDate result = jdbc.queryForObject(
            "SELECT ((TIMESTAMPTZ '2026-10-07 04:30:00+00' AT TIME ZONE 'America/Lima')::date + INTERVAL '12 months')::date",
            LocalDate.class);
        assertThat(result).isEqualTo(LocalDate.of(2027, 10, 6));
    }

    @Test
    void admin_account_has_no_expiry_and_is_never_read_only() throws Exception {
        Session admin = admin();
        assertThat(admin.user().get("expiresOn").isNull()).isTrue();
        assertThat(admin.user().get("readOnly").asBoolean()).isFalse();
    }

    // --- authentication: registro y sesión ---

    @Test
    void registration_sets_expiry_to_today_plus_12_months() throws Exception {
        Session s = user();
        assertThat(s.user().get("expiresOn").stringValue()).isEqualTo("2031-10-15");
        assertThat(s.user().get("readOnly").asBoolean()).isFalse();
        assertThat(expiryOf(s)).isEqualTo(LocalDate.of(2031, 10, 15));
    }

    @Test
    void registration_ignores_an_expiry_sent_by_the_client() throws Exception {
        Session s = register(",\"expiresOn\":\"2099-01-01\"");
        assertThat(expiryOf(s)).isEqualTo(LocalDate.of(2031, 10, 15));
    }

    @Test
    void expired_account_logs_in_read_only() throws Exception {
        Session s = user();
        expiresOn(s, TODAY.minusDays(1));
        Session again = login(s);
        assertThat(again.user().get("readOnly").asBoolean()).isTrue();
        assertThat(again.user().get("expiresOn").stringValue()).isEqualTo("2030-10-14");
    }

    @Test
    void last_day_of_access_is_still_writable() throws Exception {
        Session s = user();
        expiresOn(s, TODAY);
        assertThat(login(s).user().get("readOnly").asBoolean()).isFalse();
        createRecord(s);
    }

    // --- orthodontic-records: solo lectura ---

    @Test
    void expired_account_reads_and_prints_but_cannot_write() throws Exception {
        Session s = user();
        long id = createRecord(s);
        expiresOn(s, TODAY.minusDays(1));
        // El token anterior sigue siendo válido: manda la base, no el token.

        assertThat(mockMvc.perform(get(RECORDS).header("Authorization", bearer(s))).andReturn().getResponse().getStatus()).isEqualTo(200);
        assertThat(mockMvc.perform(get(RECORDS + "/" + id).header("Authorization", bearer(s))).andReturn().getResponse().getStatus()).isEqualTo(200);
        assertThat(mockMvc.perform(post(RECORDS + "/search").header("Authorization", bearer(s))
            .contentType(MediaType.APPLICATION_JSON).content("{\"q\":\"Pac\"}")).andReturn().getResponse().getStatus()).isEqualTo(200);
        MvcResult printed = mockMvc.perform(post(RECORDS + "/" + id + "/print").header("Authorization", bearer(s))
            .contentType(MediaType.APPLICATION_JSON).content("{}")).andReturn();
        assertThat(printed.getResponse().getStatus()).isEqualTo(200);

        MvcResult create = createRecordRaw(s);
        assertThat(create.getResponse().getStatus()).isEqualTo(403);
        assertThat(create.getResponse().getContentAsString(StandardCharsets.UTF_8)).contains("account-expired");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM orthodontic_records", Integer.class)).isEqualTo(1);

        MvcResult saved = save(s, id);
        assertThat(saved.getResponse().getStatus()).isEqualTo(403);
        assertThat(saved.getResponse().getContentAsString(StandardCharsets.UTF_8)).contains("account-expired");

        MvcResult unlock = mockMvc.perform(post(RECORDS + "/" + id + "/unlock-request").header("Authorization", bearer(s))
            .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"EDAD\"}")).andReturn();
        assertThat(unlock.getResponse().getStatus()).isEqualTo(403);
        assertThat(unlock.getResponse().getContentAsString(StandardCharsets.UTF_8)).contains("account-expired");
    }

    @Test
    void expired_account_can_still_change_its_password() throws Exception {
        Session s = user();
        expiresOn(s, TODAY.minusDays(1));
        MvcResult changed = mockMvc.perform(put("/api/me/password").header("Authorization", bearer(s))
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"currentPassword\":\"" + PASSWORD + "\",\"newPassword\":\"newpassword456\"}")).andReturn();
        assertThat(changed.getResponse().getStatus()).isEqualTo(200);
    }

    @Test
    void renewed_account_writes_with_a_token_issued_before_renewing() throws Exception {
        Session s = user();
        long id = createRecord(s);
        Session admin = admin();
        expiresOn(s, TODAY.minusDays(30));
        assertThat(save(s, id).getResponse().getStatus()).isEqualTo(403);

        assertThat(admin("POST", "/api/users/" + s.id() + "/expiry/renew", admin, null).getResponse().getStatus()).isEqualTo(200);

        assertThat(save(s, id).getResponse().getStatus()).isEqualTo(200);
    }

    // --- users: renovar y fijar ---

    @Test
    void renewing_an_expired_account_adds_12_months_from_today() throws Exception {
        Session s = user();
        Session admin = admin();
        expiresOn(s, LocalDate.of(2030, 9, 1));

        MvcResult renewed = admin("POST", "/api/users/" + s.id() + "/expiry/renew", admin, null);

        assertThat(renewed.getResponse().getStatus()).isEqualTo(200);
        JsonNode body = read(renewed);
        assertThat(body.get("expiresOn").stringValue()).isEqualTo("2031-10-15");
        assertThat(body.get("expired").asBoolean()).isFalse();
        assertThat(login(s).user().get("readOnly").asBoolean()).isFalse();
    }

    @Test
    void renewing_early_keeps_the_remaining_days() throws Exception {
        Session s = user();
        Session admin = admin();
        expiresOn(s, TODAY.plusDays(20));

        admin("POST", "/api/users/" + s.id() + "/expiry/renew", admin, null);

        assertThat(expiryOf(s)).isEqualTo(TODAY.plusDays(20).plusMonths(12));
    }

    @Test
    void setting_a_date_by_hand_keeps_access_through_that_day() throws Exception {
        Session s = user();
        Session admin = admin();

        MvcResult set = admin("PUT", "/api/users/" + s.id() + "/expiry", admin, "{\"expiresOn\":\"2030-10-15\"}");

        assertThat(set.getResponse().getStatus()).isEqualTo(200);
        assertThat(expiryOf(s)).isEqualTo(TODAY);
        createRecord(s);
        admin("PUT", "/api/users/" + s.id() + "/expiry", admin, "{\"expiresOn\":\"2030-10-14\"}");
        assertThat(createRecordRaw(s).getResponse().getStatus()).isEqualTo(403);
    }

    @Test
    void renewing_an_admin_account_is_409() throws Exception {
        Session admin = admin();
        Session other = admin();
        MvcResult renew = admin("POST", "/api/users/" + other.id() + "/expiry/renew", admin, null);
        assertThat(renew.getResponse().getStatus()).isEqualTo(409);
        assertThat(renew.getResponse().getContentAsString(StandardCharsets.UTF_8)).contains("expiry-not-applicable");
        assertThat(admin("PUT", "/api/users/" + other.id() + "/expiry", admin, "{\"expiresOn\":\"2031-01-01\"}")
            .getResponse().getStatus()).isEqualTo(409);
    }

    @Test
    void non_admin_cannot_renew_or_set_expiry() throws Exception {
        Session a = user();
        Session b = user();
        assertThat(admin("POST", "/api/users/" + b.id() + "/expiry/renew", a, null).getResponse().getStatus()).isEqualTo(403);
        assertThat(admin("PUT", "/api/users/" + b.id() + "/expiry", a, "{\"expiresOn\":\"2031-01-01\"}")
            .getResponse().getStatus()).isEqualTo(403);
    }

    @Test
    void renewing_a_missing_account_is_404() throws Exception {
        Session admin = admin();
        assertThat(admin("POST", "/api/users/9999/expiry/renew", admin, null).getResponse().getStatus()).isEqualTo(404);
    }

    // --- users: listado y filtro ---

    @Test
    void user_list_shows_expiry_and_filters_active_accounts_only() throws Exception {
        Session admin = admin();
        Session soon = user();
        Session far = user();
        Session soonDisabled = user();
        Session expired = user();
        expiresOn(soon, TODAY.plusDays(10));
        expiresOn(far, TODAY.plusDays(90));
        expiresOn(soonDisabled, TODAY.plusDays(10));
        expiresOn(expired, TODAY.minusDays(1));
        jdbc.update("UPDATE users SET status = 'DISABLED' WHERE id = ?", soonDisabled.id());

        JsonNode all = read(mockMvc.perform(get("/api/users").header("Authorization", bearer(admin))).andReturn());
        JsonNode soonRow = null;
        for (JsonNode row : all.get("content")) {
            if (row.get("id").asLong() == expired.id()) {
                assertThat(row.get("expired").asBoolean()).isTrue();
                assertThat(row.get("expiresOn").stringValue()).isEqualTo("2030-10-14");
            }
            if (row.get("id").asLong() == soon.id()) {
                soonRow = row;
            }
        }
        assertThat(soonRow).isNotNull();
        assertThat(soonRow.get("expired").asBoolean()).isFalse();

        JsonNode soonList = read(mockMvc.perform(get("/api/users?expiry=SOON").header("Authorization", bearer(admin))).andReturn());
        assertThat(soonList.get("content")).hasSize(1);
        assertThat(soonList.get("content").get(0).get("id").asLong()).isEqualTo(soon.id());

        JsonNode expiredList = read(mockMvc.perform(get("/api/users?expiry=EXPIRED").header("Authorization", bearer(admin))).andReturn());
        assertThat(expiredList.get("content")).hasSize(1);
        assertThat(expiredList.get("content").get(0).get("id").asLong()).isEqualTo(expired.id());
    }

    // --- dashboard del ADMIN ---

    @Test
    void admin_dashboard_counts_expiring_soon_and_expired_active_accounts() throws Exception {
        Session admin = admin();
        Session soon = user();
        Session soonDisabled = user();
        Session expired = user();
        user(); // vence en 12 meses: no cuenta
        expiresOn(soon, TODAY.plusDays(10));
        expiresOn(soonDisabled, TODAY.plusDays(10));
        expiresOn(expired, TODAY.minusDays(1));
        jdbc.update("UPDATE users SET status = 'DISABLED' WHERE id = ?", soonDisabled.id());

        JsonNode users = read(mockMvc.perform(get("/api/dashboard/admin").header("Authorization", bearer(admin))).andReturn()).get("users");

        assertThat(users.get("expiringSoon").asLong()).isEqualTo(1);
        assertThat(users.get("expired").asLong()).isEqualTo(1);
    }

    @Test
    void admin_dashboard_has_zero_counts_when_nothing_expires() throws Exception {
        Session admin = admin();
        user();
        JsonNode users = read(mockMvc.perform(get("/api/dashboard/admin").header("Authorization", bearer(admin))).andReturn()).get("users");
        assertThat(users.get("expiringSoon").asLong()).isZero();
        assertThat(users.get("expired").asLong()).isZero();
    }
}

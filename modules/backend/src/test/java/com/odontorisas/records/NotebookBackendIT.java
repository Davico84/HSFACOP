package com.odontorisas.records;

import com.odontorisas.AbstractIntegrationTest;
import com.odontorisas.TestRecordNumbers;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Parte del backend de la libreta local (add-orthodontic-records-local-patient-notebook): búsqueda por
 * identificadores, sin texto ni ids en la URL, con el mismo acceso por rol y sin caché.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ExtendWith(OutputCaptureExtension.class)
class NotebookBackendIT extends AbstractIntegrationTest {

    private static final String PASSWORD = "password123";
    private static final String BASE = "/api/orthodontic-records";

    @Autowired MockMvc mockMvc;
    @Autowired JdbcTemplate jdbc;

    private final JsonMapper json = JsonMapper.builder().build();

    record Session(long id, String token) {}

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

    private List<Long> ids(MvcResult result) throws Exception {
        List<Long> found = new ArrayList<>();
        read(result).get("content").forEach(row -> found.add(row.get("id").asLong()));
        return found;
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
}

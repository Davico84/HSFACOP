package com.odontorisas.presentation.controller;

import org.mockito.ArgumentCaptor;
import com.odontorisas.service.records.RecordNumberTakenException;
import com.odontorisas.TestRecordNumbers;
import com.odontorisas.common.Role;
import com.odontorisas.infra.security.JwtAuthenticationFilter;
import com.odontorisas.service.records.OrthodonticRecordService;
import com.odontorisas.service.records.RecordActor;
import com.odontorisas.service.records.RecordData;
import com.odontorisas.service.records.RecordNotFoundException;
import com.odontorisas.service.records.RecordSummaryView;
import com.odontorisas.service.records.RecordView;
import com.odontorisas.service.records.StaleRecordException;
import com.odontorisas.service.records.PatientLockedException;
import com.odontorisas.service.records.PatientNotLockedException;
import com.odontorisas.service.records.UnlockAlreadyRequestedException;
import com.odontorisas.service.records.content.RecordContent;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Forma de la API de historias sin BD: sesión requerida, validación por campo (400), mapeo de
 * 404/409 y paginación con orden fijo. Service mockeado.
 */
@WebMvcTest(controllers = OrthodonticRecordsController.class,
    excludeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE, classes = JwtAuthenticationFilter.class))
@AutoConfigureMockMvc(addFilters = false)
@Import(OrthodonticRecordsControllerTest.MethodSecurity.class)
class OrthodonticRecordsControllerTest {

    @TestConfiguration
    @EnableMethodSecurity
    static class MethodSecurity {
    }

    @Autowired MockMvc mockMvc;
    @MockitoBean OrthodonticRecordService service;

    private static final RecordView ANA = new RecordView(10L, "AEO-0015", 1L, "Dra. María Torres", "Dra. María Torres",
        "Ana Q", null, 13, LocalDate.of(2026, 5, 19),
        RecordContent.empty(), null, null, null, null, null, null, null, 2L, Instant.parse("2026-10-01T10:00:00Z"), Instant.parse("2026-10-01T10:00:00Z"));

    private static RequestPostProcessor as(long userId, String role) {
        var auth = new UsernamePasswordAuthenticationToken("u" + userId, null,
            List.of(new SimpleGrantedAuthority("ROLE_" + role)));
        auth.setDetails(userId);
        // Sin filtros, el contexto de seguridad se fija aquí (mismo hilo que MockMvc).
        return request -> {
            SecurityContextHolder.getContext().setAuthentication(auth);
            return request;
        };
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    private ResultActions create(String body) throws Exception {
        return mockMvc.perform(post("/api/orthodontic-records").with(as(1, "USER"))
            .contentType(MediaType.APPLICATION_JSON).content(TestRecordNumbers.withNumber(body, "AEO-0015")));
    }

    private ResultActions update(String body) throws Exception {
        return mockMvc.perform(put("/api/orthodontic-records/10").with(as(1, "USER"))
            .contentType(MediaType.APPLICATION_JSON).content(TestRecordNumbers.withNumber(body, "AEO-0015")));
    }

    // --- Sesión ---

    @Test
    void without_session_is_401_and_nothing_is_created() throws Exception {
        mockMvc.perform(post("/api/orthodontic-records").contentType(MediaType.APPLICATION_JSON)
                .content("{\"recordNumber\":\"AEO-0015\",\"patientAlias\":\"Ana\"}"))
            .andExpect(status().isUnauthorized());
        verify(service, never()).create(any(), any(), any());
    }

    // --- Creación ---

    @Test
    void creates_with_only_the_patient_alias_as_the_authenticated_user() throws Exception {
        when(service.create(any(), any(), any())).thenReturn(ANA);

        create("{\"patientAlias\":\"Ana Q\"}")
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").value(10))
            .andExpect(jsonPath("$.recordNumber").value("AEO-0015"))
            .andExpect(jsonPath("$.patientAlias").value("Ana Q"))
            .andExpect(jsonPath("$.patientAge").value(13))
            .andExpect(jsonPath("$.content.anamnesis").exists());
        verify(service).create(eq(new RecordActor(1L, Role.USER)), any(RecordData.class), isNull());
    }

    @Test
    void blank_alias_is_400_on_its_field() throws Exception {
        create("{\"patientAlias\":\"   \"}")
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.type").value("/errors/validation-error"))
            .andExpect(jsonPath("$.errors[0].field").value("patientAlias"))
            .andExpect(jsonPath("$.errors[0].message").value("Indica el alias del paciente."));
        verify(service, never()).create(any(), any(), any());
    }

    @Test
    void alias_rules_are_enforced_on_the_server() throws Exception {
        create("{\"patientAlias\":\"Ana Lucía Quispe\"}")
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.errors[0].field").value("patientAlias"))
            .andExpect(jsonPath("$.errors[0].message").value("Usa una o dos palabras, sin apellidos."));
        create("{\"patientAlias\":\"" + "a".repeat(31) + "\"}").andExpect(status().isBadRequest());
        create("{\"patientAlias\":\"Ana 74125896\"}").andExpect(status().isBadRequest());
        create("{\"patientAlias\":\"Ana!\"}").andExpect(status().isBadRequest());
        verify(service, never()).create(any(), any(), any());
    }

    @Test
    void age_between_0_and_99_is_accepted_and_outside_is_400() throws Exception {
        when(service.create(any(), any(), any())).thenReturn(ANA);
        create("{\"patientAlias\":\"A\",\"patientAge\":0}").andExpect(status().isCreated());
        create("{\"patientAlias\":\"A\",\"patientAge\":99}").andExpect(status().isCreated());
        create("{\"patientAlias\":\"A\",\"patientAge\":100}")
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.errors[0].field").value("patientAge"));
        create("{\"patientAlias\":\"A\",\"patientAge\":-1}").andExpect(status().isBadRequest());
        // Scenario "Edad fuera de rango": 12,5 no es una edad entera y no se trunca a 12.
        create("{\"patientAlias\":\"A\",\"patientAge\":12.5}").andExpect(status().isBadRequest());
    }

    /** Scenario "Cliente antiguo": los campos retirados se rechazan, no se ignoran en silencio. */
    @Test
    void retired_patient_fields_are_rejected_with_400_on_create_and_save() throws Exception {
        String[] retired = {
            "\"documentType\":\"DNI\"", "\"documentNumber\":\"74125896\"", "\"birthDate\":\"2012-05-20\"",
            "\"birthPlace\":\"Lima\"", "\"address\":\"Av. Sol 123\"", "\"phone\":\"987654321\""};
        for (String field : retired) {
            String name = field.substring(1, field.indexOf('"', 1));
            create("{\"patientAlias\":\"A\"," + field + "}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value(name));
            update("{\"version\":2,\"patientAlias\":\"A\"," + field + "}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value(name));
        }
        verify(service, never()).create(any(), any(), any());
        verify(service, never()).update(any(), anyLong(), anyLong(), any());
    }

    @Test
    void retired_signature_names_are_rejected_with_400() throws Exception {
        String[] retired = {"patientSignatureName", "guardianName", "guardianRelationship"};
        for (String field : retired) {
            create("{\"patientAlias\":\"A\",\"content\":{\"signatures\":{\"" + field + "\":\"Rosa\"}}}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("content.signatures." + field));
        }
        verify(service, never()).create(any(), any(), any());
    }

    // --- Límites del contenido ---

    @Test
    void long_text_over_limit_is_400_with_its_path() throws Exception {
        String tooLong = "x".repeat(4001);
        create("{\"patientAlias\":\"A\",\"content\":{\"anamnesis\":{\"chiefComplaint\":\"" + tooLong + "\"}}}")
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.errors[0].field").value("content.anamnesis.chiefComplaint"));
    }

    @Test
    void percent_and_millimeters_out_of_range_are_400() throws Exception {
        create("{\"patientAlias\":\"A\",\"content\":{\"occlusal\":{\"deepBitePercent\":101}}}")
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.errors[0].field").value("content.occlusal.deepBitePercent"));
        create("{\"patientAlias\":\"A\",\"content\":{\"occlusal\":{\"overjetMm\":31}}}")
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.errors[0].field").value("content.occlusal.overjetMm"));
    }

    @Test
    void model_measures_out_of_range_or_with_two_decimals_are_400() throws Exception {
        create("{\"patientAlias\":\"A\",\"content\":{\"models\":{\"transversal\":{\"intermolarUpper\":100}}}}")
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.errors[0].field").value("content.models.transversal.intermolarUpper"));
        create("{\"patientAlias\":\"A\",\"content\":{\"models\":{\"transversal\":{\"walaToEv\":{\"firstMolar\":2.25}}}}}")
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.errors[0].field").value("content.models.transversal.walaToEv.firstMolar"));
        create("{\"patientAlias\":\"A\",\"content\":{\"models\":{\"transversal\":{\"intercanineLower\":-1}}}}")
            .andExpect(status().isBadRequest());
        create("{\"patientAlias\":\"A\",\"content\":{\"models\":{\"moyers\":{\"lowerIncisors\":{\"tooth31\":5.45}}}}}")
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.errors[0].field").value("content.models.moyers.lowerIncisors.tooth31"));
        create("{\"patientAlias\":\"A\",\"content\":{\"models\":{\"moyers\":{\"availableSpace\":{\"maxillaLeft\":100}}}}}")
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.errors[0].field").value("content.models.moyers.availableSpace.maxillaLeft"));
        create("{\"patientAlias\":\"A\",\"content\":{\"models\":{\"moyers\":{\"crowdingPositive\":\"" + "x".repeat(201) + "\"}}}}")
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.errors[0].field").value("content.models.moyers.crowdingPositive"));
    }

    @Test
    void nance_measures_out_of_range_and_future_date_are_400() throws Exception {
        create("{\"patientAlias\":\"A\",\"content\":{\"models\":{\"nance\":{\"upperWidths\":{\"tooth21\":8.55}}}}}")
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.errors[0].field").value("content.models.nance.upperWidths.tooth21"));
        create("{\"patientAlias\":\"A\",\"content\":{\"models\":{\"nance\":{\"availableLower\":100}}}}")
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.errors[0].field").value("content.models.nance.availableLower"));
        String tomorrow = java.time.LocalDate.now().plusDays(1).toString();
        create("{\"patientAlias\":\"A\",\"content\":{\"models\":{\"nance\":{\"analysisDate\":\"" + tomorrow + "\"}}}}")
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.errors[0].field").value("content.models.nance.analysisDate"));
    }

    @Test
    void bolton_molar_out_of_range_and_future_date_are_400() throws Exception {
        create("{\"patientAlias\":\"A\",\"content\":{\"models\":{\"bolton\":{\"firstMolars\":{\"tooth46\":10.25}}}}}")
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.errors[0].field").value("content.models.bolton.firstMolars.tooth46"));
        String tomorrow = java.time.LocalDate.now().plusDays(1).toString();
        create("{\"patientAlias\":\"A\",\"content\":{\"models\":{\"bolton\":{\"analysisDate\":\"" + tomorrow + "\"}}}}")
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.errors[0].field").value("content.models.bolton.analysisDate"));
    }

    @Test
    void tooth_widths_outside_4_to_13_mm_are_400() throws Exception {
        create("{\"patientAlias\":\"A\",\"content\":{\"models\":{\"moyers\":{\"lowerIncisors\":{\"tooth42\":3.9}}}}}")
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.errors[0].field").value("content.models.moyers.lowerIncisors.tooth42"));
        create("{\"patientAlias\":\"A\",\"content\":{\"models\":{\"nance\":{\"lowerWidths\":{\"tooth35\":13.1}}}}}")
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.errors[0].field").value("content.models.nance.lowerWidths.tooth35"));
        create("{\"patientAlias\":\"A\",\"content\":{\"models\":{\"bolton\":{\"incisors\":{\"tooth21\":0.3}}}}}")
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.errors[0].field").value("content.models.bolton.incisors.tooth21"));
    }

    @Test
    void moyers_date_in_the_future_is_400() throws Exception {
        String tomorrow = java.time.LocalDate.now().plusDays(1).toString();
        create("{\"patientAlias\":\"A\",\"content\":{\"models\":{\"moyers\":{\"analysisDate\":\"" + tomorrow + "\"}}}}")
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.errors[0].field").value("content.models.moyers.analysisDate"));
    }

    @Test
    void deviated_midline_needs_at_least_half_a_millimeter() throws Exception {
        create("{\"patientAlias\":\"A\",\"content\":{\"occlusal\":{\"midlineLower\":{\"position\":\"DEVIATED_LEFT\",\"deviationMm\":0.4}}}}")
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.errors[0].field").value("content.occlusal.midlineLower.deviationMm"));
        create("{\"patientAlias\":\"A\",\"content\":{\"occlusal\":{\"midlineLower\":{\"position\":\"DEVIATED_LEFT\"}}}}")
            .andExpect(status().isBadRequest());
    }

    @Test
    void invalid_fdi_tooth_is_400() throws Exception {
        create("{\"patientAlias\":\"A\",\"content\":{\"functional\":{\"bruxismTeeth\":[16,49]}}}")
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.errors[0].field").value("content.functional.bruxismTeeth[1]"));
        create("{\"patientAlias\":\"A\",\"content\":{\"occlusal\":{\"anteriorCrossbiteTeeth\":[14]}}}")
            .andExpect(status().isBadRequest());
    }

    @Test
    void lists_over_their_limits_are_400() throws Exception {
        String items = String.join(",", java.util.Collections.nCopies(31, "\"p\""));
        create("{\"patientAlias\":\"A\",\"content\":{\"diagnosis\":{\"problemList\":[" + items + "]}}}")
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.errors[0].field").value("content.diagnosis.problemList"));
        create("{\"patientAlias\":\"A\",\"content\":{\"diagnosis\":{\"treatmentGoals\":[\"" + "x".repeat(501) + "\"]}}}")
            .andExpect(status().isBadRequest());
    }

    // --- Lectura, guardado y errores de negocio ---

    @Test
    void get_returns_the_record() throws Exception {
        when(service.get(new RecordActor(1L, Role.USER), 10L)).thenReturn(ANA);
        mockMvc.perform(get("/api/orthodontic-records/10").with(as(1, "USER")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.patientAlias").value("Ana Q"))
            .andExpect(jsonPath("$.version").value(2));
    }

    @Test
    void someone_elses_or_missing_record_is_404() throws Exception {
        when(service.get(any(), eq(10L))).thenThrow(new RecordNotFoundException());
        mockMvc.perform(get("/api/orthodontic-records/10").with(as(2, "USER")))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.type").value("/errors/record-not-found"));
    }

    @Test
    void update_passes_version_and_actor_admin_flag() throws Exception {
        when(service.update(any(), anyLong(), anyLong(), any(), any(), any())).thenReturn(ANA);
        mockMvc.perform(put("/api/orthodontic-records/10").with(as(9, "ADMIN"))
                .contentType(MediaType.APPLICATION_JSON).content("{\"version\":2,\"patientAlias\":\"Ana\",\"recordNumber\":\"AEO-0999\"}"))
            .andExpect(status().isOk());
        ArgumentCaptor<RecordData> data = ArgumentCaptor.forClass(RecordData.class);
        verify(service).update(eq(new RecordActor(9L, Role.ADMIN)), eq(10L), eq(2L), data.capture(), isNull(), isNull());
        assertThat(data.getValue().recordNumber()).isEqualTo("AEO-0999");
    }

    @Test
    void update_passes_last_step() throws Exception {
        when(service.update(any(), anyLong(), anyLong(), any(), any(), any())).thenReturn(ANA);
        update("{\"version\":2,\"patientAlias\":\"Ana\",\"lastStep\":6}").andExpect(status().isOk());
        verify(service).update(eq(new RecordActor(1L, Role.USER)), eq(10L), eq(2L), any(RecordData.class), eq(6), isNull());
    }

    @Test
    void filled_steps_out_of_range_is_400() throws Exception {
        update("{\"version\":2,\"patientAlias\":\"Ana\",\"filledSteps\":[1,9]}")
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.errors[0].field").value(org.hamcrest.Matchers.startsWith("filledSteps")));
        create("{\"patientAlias\":\"Ana\",\"filledSteps\":[0]}")
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.errors[0].field").value(org.hamcrest.Matchers.startsWith("filledSteps")));
        verify(service, never()).update(any(), anyLong(), anyLong(), any(), any(), any());
        verify(service, never()).create(any(), any(), any());
    }

    @Test
    void repeated_filled_steps_is_400() throws Exception {
        update("{\"version\":2,\"patientAlias\":\"Ana\",\"filledSteps\":[1,1,2]}")
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.errors[0].field").value("filledSteps"));
        verify(service, never()).update(any(), anyLong(), anyLong(), any(), any(), any());
    }

    @Test
    void update_passes_filled_steps() throws Exception {
        when(service.update(any(), anyLong(), anyLong(), any(), any(), any())).thenReturn(ANA);
        update("{\"version\":2,\"patientAlias\":\"Ana\",\"filledSteps\":[1,2,5]}").andExpect(status().isOk());
        verify(service).update(eq(new RecordActor(1L, Role.USER)), eq(10L), eq(2L), any(RecordData.class), isNull(),
            eq(List.of(1, 2, 5)));
    }

    @ParameterizedTest
    @ValueSource(ints = {0, 9})
    void last_step_out_of_range_is_400(int step) throws Exception {
        update("{\"version\":2,\"patientAlias\":\"Ana\",\"lastStep\":" + step + "}")
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.errors[0].field").value("lastStep"));
        verify(service, never()).update(any(), anyLong(), anyLong(), any(), any());
    }

    @Test
    void update_without_version_is_400() throws Exception {
        update("{\"patientAlias\":\"Ana\"}")
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.errors[0].field").value("version"));
    }

    // --- Datos del paciente fijos ---

    @Test
    void changing_locked_patient_data_is_409_with_its_type() throws Exception {
        when(service.update(any(), anyLong(), anyLong(), any(), any(), any())).thenThrow(new PatientLockedException());
        update("{\"version\":1,\"patientAlias\":\"Otra\"}")
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.type").value("/errors/patient-locked"));
    }

    @Test
    void print_of_someone_elses_record_is_404() throws Exception {
        when(service.print(any(), eq(10L), any())).thenThrow(new RecordNotFoundException());
        mockMvc.perform(post("/api/orthodontic-records/10/print").with(as(2, "USER")))
            .andExpect(status().isNotFound());
    }

    @Test
    void user_cannot_unlock_or_discard() throws Exception {
        mockMvc.perform(delete("/api/orthodontic-records/10/patient-lock").with(as(1, "USER")))
            .andExpect(status().isForbidden());
        mockMvc.perform(delete("/api/orthodontic-records/10/unlock-request").with(as(1, "USER")))
            .andExpect(status().isForbidden());
        verify(service, never()).unlockPatient(any(), anyLong());
        verify(service, never()).discardUnlockRequest(any(), anyLong());
    }

    @Test
    void admin_unlock_is_204_and_not_locked_is_409() throws Exception {
        mockMvc.perform(delete("/api/orthodontic-records/10/patient-lock").with(as(9, "ADMIN")))
            .andExpect(status().isNoContent());
        org.mockito.Mockito.doThrow(new PatientNotLockedException()).when(service).unlockPatient(any(), eq(11L));
        mockMvc.perform(delete("/api/orthodontic-records/11/patient-lock").with(as(9, "ADMIN")))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.type").value("/errors/patient-not-locked"));
    }

    @Test
    void unlock_request_needs_a_reason_from_the_closed_catalog() throws Exception {
        mockMvc.perform(post("/api/orthodontic-records/10/unlock-request").with(as(1, "USER"))
                .contentType(MediaType.APPLICATION_JSON).content("{}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.errors[0].field").value("reason"));
        // Scenario "Motivo fuera del catálogo": un texto libre, aunque sea corto, no se acepta.
        mockMvc.perform(post("/api/orthodontic-records/10/unlock-request").with(as(1, "USER"))
                .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"Error en el DNI\"}"))
            .andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/orthodontic-records/10/unlock-request").with(as(1, "USER"))
                .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"alias\"}"))
            .andExpect(status().isBadRequest());
        verify(service, never()).requestUnlock(any(), anyLong(), any());
    }

    @Test
    void repeated_unlock_request_is_409_with_its_type() throws Exception {
        org.mockito.Mockito.doThrow(new UnlockAlreadyRequestedException()).when(service).requestUnlock(any(), anyLong(), any());
        mockMvc.perform(post("/api/orthodontic-records/10/unlock-request").with(as(1, "USER"))
                .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"ALIAS\"}"))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.type").value("/errors/unlock-already-requested"));
    }

    @Test
    void stale_version_is_409_with_its_type() throws Exception {
        when(service.update(any(), anyLong(), anyLong(), any(), any(), any())).thenThrow(new StaleRecordException());
        update("{\"version\":1,\"patientAlias\":\"Ana\"}")
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.type").value("/errors/stale-record"));
    }

    @Test
    void taken_record_number_is_409_with_its_type_and_message() throws Exception {
        when(service.update(any(), anyLong(), anyLong(), any(), any(), any()))
            .thenThrow(new RecordNumberTakenException("AEO-0015"));
        update("{\"version\":1,\"patientAlias\":\"Ana\"}")
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.type").value("/errors/record-number-taken"))
            .andExpect(jsonPath("$.detail").value(
                "El número AEO-0015 ya está registrado en otra historia. Verifica el número con la coordinación."));
    }

    @Test
    void missing_or_malformed_record_number_is_400_on_its_field() throws Exception {
        create("{\"recordNumber\":\"\",\"patientAlias\":\"Ana\"}")
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.errors[?(@.field == 'recordNumber')]").exists());
        create("{\"recordNumber\":\"AOC-0015\",\"patientAlias\":\"Ana\"}")
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.errors[?(@.field == 'recordNumber')].message").value("Usa el formato AEO-0001."));
        verify(service, never()).create(any(), any(), any());
    }

    // --- Listado ---

    private static final org.springframework.data.domain.PageRequest FIXED_SORT_FIRST_PAGE =
        org.springframework.data.domain.PageRequest.of(0, 100,
            org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Order.desc("updatedAt"),
                org.springframework.data.domain.Sort.Order.desc("id")));

    private void stubListWith(RecordSummaryView row) {
        when(service.list(any(), any(), any(), any(Pageable.class))).thenAnswer(inv ->
            new PageImpl<>(List.of(row), inv.getArgument(3), 1));
    }

    private static RecordSummaryView sampleRow() {
        return new RecordSummaryView(10L, "AEO-0015", "Ana Q", "Dra. Torres",
            null, "Dra. Torres", null, Instant.parse("2026-10-01T10:00:00Z"), false);
    }

    private org.springframework.test.web.servlet.ResultActions search(String body, String role, String... query)
            throws Exception {
        var req = post("/api/orthodontic-records/search" + (query.length == 0 ? "" : "?" + query[0]))
            .with(as(1, role)).contentType(MediaType.APPLICATION_JSON);
        return mockMvc.perform(body == null ? req : req.content(body));
    }

    @Test
    void list_uses_fixed_sort_and_capped_size_and_never_searches() throws Exception {
        stubListWith(sampleRow());

        mockMvc.perform(get("/api/orthodontic-records").with(as(1, "USER"))
                .param("size", "500").param("sort", "patientName"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content[0].recordNumber").value("AEO-0015"))
            .andExpect(jsonPath("$.content[0].authorName").value("Dra. Torres"))
            .andExpect(jsonPath("$.size").value(100));
        verify(service).list(eq(new RecordActor(1L, Role.USER)), isNull(), isNull(), eq(FIXED_SORT_FIRST_PAGE));
    }

    /** Scenario "Parámetro q retirado": el GET ignora q y lista sin filtrar por ese texto. */
    @Test
    void list_ignores_the_retired_q_parameter() throws Exception {
        stubListWith(sampleRow());

        mockMvc.perform(get("/api/orthodontic-records").with(as(1, "USER")).param("q", "quispe"))
            .andExpect(status().isOk());
        verify(service).list(any(), isNull(), isNull(), any(Pageable.class));
        verify(service, never()).list(any(), eq("quispe"), any(), any(Pageable.class));
    }

    /** Scenario "Buscar por nombre": el texto llega en el cuerpo y la URL no lo contiene. */
    @Test
    void search_takes_the_text_from_the_body_and_keeps_the_same_output() throws Exception {
        stubListWith(sampleRow());

        search("{\"q\":\"quispe\"}", "USER", "size=500")
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content[0].recordNumber").value("AEO-0015"))
            .andExpect(jsonPath("$.content[0].authorName").value("Dra. Torres"))
            .andExpect(jsonPath("$.size").value(100));
        verify(service).list(eq(new RecordActor(1L, Role.USER)), eq("quispe"), isNull(), eq(FIXED_SORT_FIRST_PAGE));
    }

    /** Scenario "Paginación y turma": página y turma siguen como parámetros de la operación. */
    @Test
    void search_keeps_page_and_cohort_as_parameters() throws Exception {
        stubListWith(sampleRow());

        search("{\"q\":\"\"}", "COORDINATOR", "page=2&cohortId=7").andExpect(status().isOk());
        verify(service).list(eq(new RecordActor(1L, Role.COORDINATOR)), eq(""), eq(7L),
            eq(org.springframework.data.domain.PageRequest.of(2, 20,
                org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Order.desc("updatedAt"),
                    org.springframework.data.domain.Sort.Order.desc("id")))));
    }

    /** Scenario "Acceso por rol en la búsqueda": se pasa el actor autenticado; el alcance lo aplica el servicio. */
    @Test
    void search_passes_the_authenticated_actor_to_the_service() throws Exception {
        stubListWith(sampleRow());

        search("{\"q\":\"quispe\"}", "USER").andExpect(status().isOk());
        verify(service).list(eq(new RecordActor(1L, Role.USER)), eq("quispe"), isNull(), any(Pageable.class));
    }

    /** Scenario "Texto en el límite": 120 caracteres pasan, 121 devuelven 400 sin buscar. */
    @Test
    void search_text_limit_is_120_characters() throws Exception {
        stubListWith(sampleRow());

        search("{\"q\":\"" + "a".repeat(120) + "\"}", "USER").andExpect(status().isOk());
        verify(service).list(any(), eq("a".repeat(120)), any(), any(Pageable.class));

        org.mockito.Mockito.clearInvocations(service);
        search("{\"q\":\"" + "a".repeat(121) + "\"}", "USER").andExpect(status().isBadRequest());
        verify(service, never()).list(any(), any(), any(), any(Pageable.class));
    }

    /** Scenario "Cuerpo inválido": vacío, no objeto o con campos desconocidos responden 400. */
    /** Scenarios "Buscar por identificadores", "Más de 50 identificadores" y "Texto e identificadores a la vez". */
    @Test
    void search_by_ids_takes_them_from_the_body_without_text_and_is_never_cached() throws Exception {
        when(service.listByIds(any(), any(), any(), any())).thenReturn(new PageImpl<>(List.of(sampleRow())));

        search("{\"recordIds\":[10,11,12]}", "USER")
            .andExpect(status().isOk())
            .andExpect(header().string("Cache-Control", org.hamcrest.Matchers.containsString("no-store")))
            .andExpect(jsonPath("$.content[0].recordNumber").value("AEO-0015"));

        verify(service).listByIds(eq(new RecordActor(1L, Role.USER)), eq(List.of(10L, 11L, 12L)), isNull(), any());
        verify(service, never()).list(any(), any(), any(), any());
    }

    @Test
    void a_text_search_is_not_cached_either() throws Exception {
        when(service.list(any(), any(), any(), any())).thenReturn(new PageImpl<>(List.of(sampleRow())));
        search("{\"q\":\"mateo\"}", "USER")
            .andExpect(status().isOk())
            .andExpect(header().string("Cache-Control", org.hamcrest.Matchers.containsString("no-store")));
    }

    @Test
    void search_by_ids_accepts_up_to_50_and_rejects_51() throws Exception {
        when(service.listByIds(any(), any(), any(), any())).thenReturn(new PageImpl<>(List.of()));
        String fifty = java.util.stream.IntStream.rangeClosed(1, 50).mapToObj(String::valueOf).collect(java.util.stream.Collectors.joining(","));
        String fiftyOne = fifty + ",51";

        search("{\"recordIds\":[" + fifty + "]}", "USER").andExpect(status().isOk());
        search("{\"recordIds\":[" + fiftyOne + "]}", "USER").andExpect(status().isBadRequest());
    }

    @Test
    void search_needs_exactly_text_or_ids_and_valid_ids() throws Exception {
        search("{\"q\":\"mateo\",\"recordIds\":[10]}", "USER").andExpect(status().isBadRequest());
        search("{}", "USER").andExpect(status().isBadRequest());
        search("{\"recordIds\":[0]}", "USER").andExpect(status().isBadRequest());
        search("{\"recordIds\":[-3]}", "USER").andExpect(status().isBadRequest());
        search("{\"recordIds\":[null]}", "USER").andExpect(status().isBadRequest());
        search("{\"recordIds\":\"10\"}", "USER").andExpect(status().isBadRequest());
        search("{\"recordIds\":[10],\"extra\":1}", "USER").andExpect(status().isBadRequest());
        verify(service, never()).listByIds(any(), any(), any(), any());
    }

    @Test
    void search_rejects_empty_non_object_and_unknown_field_bodies() throws Exception {
        search(null, "USER").andExpect(status().isBadRequest());
        search("[]", "USER").andExpect(status().isBadRequest());
        search("\"quispe\"", "USER").andExpect(status().isBadRequest());
        search("{}", "USER").andExpect(status().isBadRequest());
        search("{\"q\":\"quispe\",\"extra\":1}", "USER").andExpect(status().isBadRequest());
        verify(service, never()).list(any(), any(), any(), any(Pageable.class));
    }
}

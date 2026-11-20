package com.odontorisas.service.records.migration;

import com.odontorisas.service.records.PatientAlias;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.assertj.core.api.Assertions.assertThat;

/** Scenario "Nombre vacío, de una palabra o con partículas": el alias inicial de cada nombre antiguo. */
class LegacyAliasTest {

    @Test
    void null_blank_or_only_particles_become_paciente() {
        assertThat(LegacyAlias.fromName(null)).isEqualTo("Paciente");
        assertThat(LegacyAlias.fromName("")).isEqualTo("Paciente");
        assertThat(LegacyAlias.fromName("   ")).isEqualTo("Paciente");
        assertThat(LegacyAlias.fromName("de la")).isEqualTo("Paciente");
    }

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
        "Ana|Ana",
        "Ana Quispe|Ana Q",
        "  ANA    quispe  |ANA Q",
        "de la Cruz Rojas|Cruz R",
        "María José Quispe|María J",
        "Ana del Carmen Rojas|Ana C",
        "Ａｎａ Quispe|Ana Q",
        "Dr. Juan Pérez|Dr J"
    })
    void initial_alias_is_the_first_word_plus_the_initial_of_the_second(String name, String expected) {
        assertThat(LegacyAlias.fromName(name)).isEqualTo(expected);
    }

    @Test
    void signs_and_long_digit_runs_are_removed_so_the_alias_always_passes_the_rules() {
        assertThat(LegacyAlias.fromName("Ana, 74125896 Quispe")).isEqualTo("Ana Q");
        assertThat(LegacyAlias.fromName("@@@ !!!")).isEqualTo("Paciente");
        for (String name : new String[] {"Ana, Quispe", "J.R. Torres", "Ana 12 Quispe", "74125896", "𝐚𝐛𝐜 Quispe"}) {
            assertThat(PatientAlias.violation(LegacyAlias.fromName(name))).as(name).isNull();
        }
    }

    @Test
    void a_very_long_first_word_is_cut_to_30_code_points() {
        String alias = LegacyAlias.fromName("a".repeat(45) + " Quispe");
        assertThat(alias.codePointCount(0, alias.length())).isLessThanOrEqualTo(30);
        assertThat(PatientAlias.violation(alias)).isNull();
    }
}

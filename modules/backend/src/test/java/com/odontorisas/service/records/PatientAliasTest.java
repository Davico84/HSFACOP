package com.odontorisas.service.records;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Vectores del alias (design D2). El navegador usa los mismos casos (tarea 1.2c): 30 y 31 puntos de
 * código, 2 y 3 palabras, espacios repetidos, dígitos, caracteres no permitidos y Unicode.
 */
class PatientAliasTest {

    @ParameterizedTest
    @ValueSource(strings = {"Mateo", "Ana Q", "  Ana    Q  ", "Jean-Luc", "D'Angelo", "María José", "Ana 12",
        "Ana 12345", "Ａｎａ", "李明", "Ñandú Ç"})
    void valid_aliases(String alias) {
        assertThat(PatientAlias.violation(alias)).isNull();
    }

    @Test
    void thirty_code_points_pass_and_thirty_one_do_not() {
        assertThat(PatientAlias.violation("a".repeat(30))).isNull();
        assertThat(PatientAlias.violation("a".repeat(31))).isEqualTo("El alias admite hasta 30 caracteres.");
    }

    @Test
    void length_counts_code_points_not_chars() {
        // Cada letra matemática ocupa 2 chars en UTF-16 y 1 punto de código; NFKC la lleva a una letra latina.
        assertThat(PatientAlias.violation("𝐚".repeat(30))).isNull();
        assertThat(PatientAlias.violation("𝐚".repeat(31))).isNotNull();
    }

    @Test
    void two_words_pass_and_three_do_not() {
        assertThat(PatientAlias.violation("Ana Quispe")).isNull();
        assertThat(PatientAlias.violation("Ana Lucía Quispe")).isEqualTo("Usa una o dos palabras, sin apellidos.");
    }

    @Test
    void repeated_spaces_are_collapsed_before_counting_words() {
        assertThat(PatientAlias.normalize("  Ana     Q ")).isEqualTo("Ana Q");
        assertThat(PatientAlias.violation("Ana     Q")).isNull();
    }

    @Test
    void five_digits_pass_and_six_do_not() {
        assertThat(PatientAlias.violation("Ana 12345")).isNull();
        assertThat(PatientAlias.violation("Ana 123456")).isEqualTo("No escribas números de documento en el alias.");
        assertThat(PatientAlias.violation("74125896")).isNotNull();
    }

    @ParameterizedTest
    @ValueSource(strings = {"Ana!", "Ana_Q", "Ana@", "Ana.", "Ana😀", "Ana\tQ\u0001"})
    void forbidden_characters_are_rejected(String alias) {
        assertThat(PatientAlias.violation(alias)).isNotNull();
    }

    @Test
    void blank_or_null_alias_is_rejected() {
        assertThat(PatientAlias.violation(null)).isEqualTo("Indica el alias del paciente.");
        assertThat(PatientAlias.violation("   ")).isEqualTo("Indica el alias del paciente.");
    }
}

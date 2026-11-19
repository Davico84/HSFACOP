package com.odontorisas.service.records;

import com.odontorisas.common.PatientSex;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** Forma canónica de los datos fijos: corregir la escritura no cambia la identidad; otro paciente, sí. */
class PatientIdentityTest {

    private static PatientIdentity id(String alias, PatientSex sex, Integer age) {
        return PatientIdentity.of(alias, sex, age);
    }

    @Test
    void case_accents_spaces_and_unicode_forms_are_the_same_identity() {
        PatientIdentity base = id("Ana Q", PatientSex.FEMALE, 13);
        assertThat(id("ANA  Q", PatientSex.FEMALE, 13)).isEqualTo(base);
        assertThat(id("  ana q ", PatientSex.FEMALE, 13)).isEqualTo(base);
        // Las letras de ancho completo y las formas compuestas son la misma escritura en NFKC.
        assertThat(id("Ａｎａ Q", PatientSex.FEMALE, 13)).isEqualTo(base);
        assertThat(id("María", PatientSex.FEMALE, 13)).isEqualTo(id("MARIA", PatientSex.FEMALE, 13));
    }

    @Test
    void another_alias_sex_or_age_is_another_identity() {
        PatientIdentity base = id("Ana Q", PatientSex.FEMALE, 13);
        assertThat(id("Rosa D", PatientSex.FEMALE, 13)).isNotEqualTo(base);
        assertThat(id("Ana Q", PatientSex.MALE, 13)).isNotEqualTo(base);
        assertThat(id("Ana Q", PatientSex.FEMALE, 14)).isNotEqualTo(base);
        assertThat(id("Ana Q", PatientSex.FEMALE, null)).isNotEqualTo(base);
    }

    @Test
    void missing_alias_compares_as_empty() {
        assertThat(id(null, null, null)).isEqualTo(id("   ", null, null));
    }
}

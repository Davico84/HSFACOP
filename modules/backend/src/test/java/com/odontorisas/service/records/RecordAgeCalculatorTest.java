package com.odontorisas.service.records;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** Scenarios de "Sin edad" y de la edad escrita: rango 0 a 99, opcional, y quién firma. */
class RecordAgeCalculatorTest {

    @Test
    void age_is_valid_from_0_to_99_and_optional() {
        assertThat(RecordAgeCalculator.isInRange(0)).isTrue();
        assertThat(RecordAgeCalculator.isInRange(17)).isTrue();
        assertThat(RecordAgeCalculator.isInRange(18)).isTrue();
        assertThat(RecordAgeCalculator.isInRange(99)).isTrue();
        assertThat(RecordAgeCalculator.isInRange(null)).isTrue();
    }

    @Test
    void age_outside_the_range_is_invalid() {
        assertThat(RecordAgeCalculator.isInRange(-1)).isFalse();
        assertThat(RecordAgeCalculator.isInRange(100)).isFalse();
    }

    @Test
    void minor_only_when_age_is_known_and_under_18() {
        assertThat(RecordAgeCalculator.isMinor(0)).isTrue();
        assertThat(RecordAgeCalculator.isMinor(17)).isTrue();
        assertThat(RecordAgeCalculator.isMinor(18)).isFalse();
        assertThat(RecordAgeCalculator.isMinor(99)).isFalse();
        assertThat(RecordAgeCalculator.isMinor(null)).isFalse();
    }
}

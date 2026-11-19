package com.odontorisas.service.records;

/**
 * Edad escrita del paciente (design D3): años cumplidos al inicio del tratamiento. El servidor ya
 * no la calcula, solo valida el rango y decide con ella si firma un apoderado. Única fuente de la
 * regla en el backend.
 */
public final class RecordAgeCalculator {

    /** Mayoría de edad: por debajo firma el apoderado. */
    public static final int ADULT_AGE = 18;
    public static final int MIN_AGE = 0;
    public static final int MAX_AGE = 99;

    private RecordAgeCalculator() {
    }

    /** ¿Es una edad válida? Sin edad (nula) también lo es: el campo es opcional. */
    public static boolean isInRange(Integer ageYears) {
        return ageYears == null || (ageYears >= MIN_AGE && ageYears <= MAX_AGE);
    }

    /** ¿Firma un apoderado? Solo si se conoce la edad y es menor de 18. */
    public static boolean isMinor(Integer ageYears) {
        return ageYears != null && ageYears < ADULT_AGE;
    }
}

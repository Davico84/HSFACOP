package com.odontorisas.service.records;

import com.odontorisas.common.PatientSex;
import com.odontorisas.common.text.SearchNormalizer;

/**
 * Datos del paciente que quedan fijos al imprimir, en forma canónica para compararlos: el alias sin
 * distinguir formas Unicode equivalentes (NFKC), tildes, mayúsculas ni espacios sobrantes, más el
 * sexo y la edad. Corregir la escritura del alias no cambia la identidad; otro paciente, sí.
 */
public record PatientIdentity(String alias, PatientSex sex, Integer age) {

    public static PatientIdentity of(String alias, PatientSex sex, Integer age) {
        String normalized = PatientAlias.normalize(alias);
        return new PatientIdentity(normalized == null ? "" : SearchNormalizer.normalize(normalized), sex, age);
    }
}

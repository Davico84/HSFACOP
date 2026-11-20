package com.odontorisas.service.records;

import java.text.Normalizer;
import java.util.regex.Pattern;

/**
 * Reglas del alias del paciente (design D2): se normaliza con Unicode NFKC, sin espacios al inicio
 * ni al final y con los espacios repetidos reducidos a uno; de 1 a 30 puntos de código, hasta 2
 * palabras, solo letras, marcas, dígitos, guion y apóstrofo, y sin secuencias de 6 o más dígitos
 * (evita pegar un documento). Son las mismas reglas que aplica el navegador (vectores compartidos).
 * El servidor valida forma y límites; no puede saber si es un nombre real.
 */
public final class PatientAlias {

    public static final int MAX_CODE_POINTS = 30;
    public static final int MAX_WORDS = 2;
    public static final int MAX_DIGIT_RUN = 5;

    private static final Pattern SPACES = Pattern.compile("\\s+");
    private static final Pattern ALLOWED = Pattern.compile("[\\p{L}\\p{M}\\p{N}'’-]+(?: [\\p{L}\\p{M}\\p{N}'’-]+)?");
    private static final Pattern DIGIT_RUN = Pattern.compile("\\p{Nd}{" + (MAX_DIGIT_RUN + 1) + ",}");

    private PatientAlias() {
    }

    /** NFKC, recortado y con espacios colapsados; {@code null} se queda en {@code null}. */
    public static String normalize(String alias) {
        if (alias == null) {
            return null;
        }
        return SPACES.matcher(Normalizer.normalize(alias, Normalizer.Form.NFKC)).replaceAll(" ").strip();
    }

    /** Motivo del primer incumplimiento del alias ya normalizado, o {@code null} si es válido. */
    public static String violation(String alias) {
        String value = normalize(alias);
        if (value == null || value.isEmpty()) {
            return "Indica el alias del paciente.";
        }
        if (value.codePointCount(0, value.length()) > MAX_CODE_POINTS) {
            return "El alias admite hasta 30 caracteres.";
        }
        if (value.split(" ").length > MAX_WORDS) {
            return "Usa una o dos palabras, sin apellidos.";
        }
        if (!ALLOWED.matcher(value).matches()) {
            return "Usa solo letras, números, guion y apóstrofo.";
        }
        if (DIGIT_RUN.matcher(value).find()) {
            return "No escribas números de documento en el alias.";
        }
        return null;
    }
}

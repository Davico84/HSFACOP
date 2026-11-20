package com.odontorisas.service.records.migration;

import com.odontorisas.service.records.PatientAlias;

import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Alias inicial de una historia existente (design D8): el nombre normalizado (NFKC, sin espacios
 * sobrantes) se parte en palabras, se quitan las partículas, y el alias es la primera palabra más la
 * inicial de la segunda ("Ana Q"), o solo la primera si no hay segunda, truncado a 30 puntos de
 * código. Nombre nulo, vacío o solo partículas: "Paciente". Es un valor inicial que el tratante puede
 * cambiar; nombre de pila más inicial identifica menos que el apellido completo.
 */
public final class LegacyAlias {

    static final String FALLBACK = "Paciente";
    private static final Set<String> PARTICLES = Set.of("de", "del", "la", "las", "los", "y", "san", "santa");
    private static final Pattern DISALLOWED = Pattern.compile("[^\\p{L}\\p{M}\\p{N}'’-]");
    private static final Pattern DIGIT_RUN = Pattern.compile("\\p{Nd}{" + (PatientAlias.MAX_DIGIT_RUN + 1) + ",}");

    private LegacyAlias() {
    }

    public static String fromName(String name) {
        String normalized = PatientAlias.normalize(name);
        if (normalized == null || normalized.isEmpty()) {
            return FALLBACK;
        }
        // El alias propuesto debe cumplir las reglas del alias: se quitan signos y secuencias de dígitos.
        List<String> words = Arrays.stream(normalized.split(" "))
            .map(word -> DIGIT_RUN.matcher(DISALLOWED.matcher(word).replaceAll("")).replaceAll(""))
            .filter(word -> !word.isEmpty() && !PARTICLES.contains(word.toLowerCase(Locale.ROOT)))
            .toList();
        if (words.isEmpty()) {
            return FALLBACK;
        }
        String alias = words.size() == 1 ? words.get(0) : words.get(0) + " " + initial(words.get(1));
        return truncate(alias);
    }

    private static String initial(String word) {
        int first = word.codePointAt(0);
        return new String(Character.toChars(first)).toUpperCase(Locale.ROOT);
    }

    private static String truncate(String alias) {
        int limit = PatientAlias.MAX_CODE_POINTS;
        if (alias.codePointCount(0, alias.length()) <= limit) {
            return alias;
        }
        String cut = alias.substring(0, alias.offsetByCodePoints(0, limit)).strip();
        return cut.isEmpty() ? FALLBACK : cut;
    }
}

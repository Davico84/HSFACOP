package com.odontorisas.presentation.dto;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.fasterxml.jackson.annotation.JsonIgnore;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Búsqueda de historias, por texto o por identificadores. Ni el texto ni los identificadores viajan en
 * la URL, porque la URL queda en los registros de acceso del proveedor o de un proxy: van en el cuerpo.
 * Exactamente uno de los dos: el texto (alias o número) o la lista de hasta 50 identificadores que
 * resuelve la búsqueda local de la libreta. Rechaza campos desconocidos (Spring Boot los ignora por
 * defecto): se anotan al deserializar y la validación los marca.
 */
public class SearchRecordsRequest {

    @Schema(description = "Busca en alias y número (sin distinguir tildes ni mayúsculas); vacío lista sin filtrar. No va con recordIds",
        maxLength = 120, nullable = true)
    @Size(max = 120, message = "La búsqueda admite hasta 120 caracteres.")
    private String q;

    @Schema(description = "Identificadores de historias (hasta 50), de la búsqueda local de la libreta. No va con q", nullable = true)
    @Size(max = 50, message = "Se admiten hasta 50 identificadores.")
    private List<@NotNull @Positive Long> recordIds;

    @JsonIgnore
    private final Set<String> unknownFields = new HashSet<>();

    public String getQ() {
        return q;
    }

    public void setQ(String q) {
        this.q = q;
    }

    public List<Long> getRecordIds() {
        return recordIds;
    }

    public void setRecordIds(List<Long> recordIds) {
        this.recordIds = recordIds;
    }

    @JsonAnySetter
    void unknownField(String name, Object value) {
        unknownFields.add(name);
    }

    @JsonIgnore
    @Schema(hidden = true)
    @AssertTrue(message = "Solo se admiten los campos q y recordIds.")
    public boolean isOnlyKnownFields() {
        return unknownFields.isEmpty();
    }

    @JsonIgnore
    @Schema(hidden = true)
    @AssertTrue(message = "Indica el texto a buscar o los identificadores, pero no los dos.")
    public boolean isExactlyOneCriterion() {
        return (q != null) != (recordIds != null);
    }
}

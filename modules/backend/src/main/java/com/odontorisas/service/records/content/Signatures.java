package com.odontorisas.service.records.content;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Null;
import jakarta.validation.constraints.Size;

import static com.odontorisas.service.records.content.ContentLimits.SHORT_TEXT;

/**
 * Paso 7 (pág. 13): nombres de quienes firman a mano. La fecha se llena sobre el papel. Firma
 * el apoderado si el paciente es menor de 18 años; si no, el paciente, y su nombre se escribe a
 * mano sobre la hoja impresa. El servidor ya no guarda el nombre ni el parentesco del paciente ni
 * del apoderado: los tres componentes retirados solo existen para rechazar con {@code 400} a un
 * cliente antiguo que los envíe y para leer el contenido guardado antes del cambio; nunca se
 * serializan.
 */
public record Signatures(
    @Schema(hidden = true) @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    @Null(message = "El nombre de quien firma ya no se guarda en el sistema.") String patientSignatureName,
    @Schema(hidden = true) @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    @Null(message = "El nombre de quien firma ya no se guarda en el sistema.") String guardianName,
    @Schema(hidden = true) @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    @Null(message = "El parentesco de quien firma ya no se guarda en el sistema.") String guardianRelationship,
    @Size(max = SHORT_TEXT) String supervisor1Name,
    @Size(max = SHORT_TEXT) String supervisor2Name,
    @Size(max = SHORT_TEXT) String treatingSignatureName) {

    public static Signatures empty() {
        return new Signatures(null, null, null, null, null, null);
    }
}

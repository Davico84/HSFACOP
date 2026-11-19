package com.odontorisas.presentation.dto;

import com.odontorisas.common.PatientSex;
import jakarta.validation.constraints.Null;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.odontorisas.service.records.RecordData;
import com.odontorisas.service.records.content.RecordContent;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import java.util.List;
import org.hibernate.validator.constraints.UniqueElements;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

/**
 * Nueva historia: bastan el número que asignan los docentes y el alias del paciente (es un
 * borrador). El autor lo asigna el servidor; el tratante, si falta, es el nombre del autor.
 */
@PatientFields.Consistent
public record CreateRecordRequest(
    @Schema(requiredMode = REQUIRED, description = "Número de historia que asignan los docentes", example = "AEO-0015")
    @NotBlank(message = "Indica el número de historia.")
    @Pattern(regexp = "AEO-[0-9]{4}", message = "Usa el formato AEO-0001.")
    String recordNumber,
    @Size(max = 120) String treatingDentist,
    @Schema(requiredMode = REQUIRED, description = "Alias del paciente: una o dos palabras, sin apellidos (máx. 30)", example = "Mateo")
    String patientAlias,
    PatientSex patientSex,
    @Schema(description = "Años cumplidos al inicio del tratamiento (0–99); se escribe, no se calcula", nullable = true)
    @Min(value = 0, message = "Usa una edad entre 0 y 99 años.") @Max(value = 99, message = "Usa una edad entre 0 y 99 años.")
    Integer patientAge,
    @Schema(hidden = true) @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    @Null(message = "El tipo de documento ya no se guarda en el sistema.") Object documentType,
    @Schema(hidden = true) @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    @Null(message = "El número de documento ya no se guarda en el sistema.") Object documentNumber,
    @Schema(hidden = true) @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    @Null(message = "La fecha de nacimiento ya no se guarda en el sistema.") Object birthDate,
    @Schema(hidden = true) @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    @Null(message = "El lugar de nacimiento ya no se guarda en el sistema.") Object birthPlace,
    @Schema(hidden = true) @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    @Null(message = "El domicilio ya no se guarda en el sistema.") Object address,
    @Schema(hidden = true) @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    @Null(message = "El celular del paciente ya no se guarda en el sistema.") Object phone,
    LocalDate treatmentStartDate,
    @Valid RecordContent content,
    @Schema(description = "Pasos del formulario (1–8) con datos; el paso 1 siempre cuenta")
    @UniqueElements(message = "Los pasos no pueden repetirse.")
    List<@Min(value = 1, message = "El paso debe estar entre 1 y 8.") @Max(value = 8, message = "El paso debe estar entre 1 y 8.") Integer> filledSteps) implements PatientFields {

    public RecordData toData() {
        return new RecordData(recordNumber, treatingDentist, patientAlias, patientSex, patientAge, treatmentStartDate, content);
    }
}

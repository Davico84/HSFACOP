package com.odontorisas.presentation.dto;

import com.odontorisas.common.DocumentType;
import com.odontorisas.service.records.LegacyIdentityView;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDate;

/**
 * Datos antiguos del paciente que el servidor ya no guarda, devueltos solo al autor de la historia
 * hasta la fecha límite de copia para que los pase a su libreta local. Todo es opcional: había
 * historias incompletas. Nunca se cachea ni se registra.
 */
public record LegacyIdentityResponse(
    @Schema(description = "Nombre completo original del paciente", nullable = true) String patientName,
    @Schema(nullable = true) DocumentType documentType,
    @Schema(nullable = true) String documentNumber,
    @Schema(nullable = true) LocalDate birthDate,
    @Schema(nullable = true) String birthPlace,
    @Schema(nullable = true) String address,
    @Schema(nullable = true) String phone,
    @Schema(description = "Nombre de quien firma si es el paciente", nullable = true) String patientSignatureName,
    @Schema(description = "Nombre del apoderado si el paciente es menor de edad", nullable = true) String guardianName,
    @Schema(description = "Parentesco del apoderado", nullable = true) String guardianRelationship) {

    public static LegacyIdentityResponse from(LegacyIdentityView row) {
        return new LegacyIdentityResponse(row.patientName(), row.documentType(), row.documentNumber(), row.birthDate(),
            row.birthPlace(), row.address(), row.phone(), row.patientSignatureName(), row.guardianName(),
            row.guardianRelationship());
    }
}

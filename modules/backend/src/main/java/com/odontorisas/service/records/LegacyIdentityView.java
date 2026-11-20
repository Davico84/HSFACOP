package com.odontorisas.service.records;

import com.odontorisas.common.DocumentType;

import java.time.Instant;
import java.time.LocalDate;

/**
 * Datos antiguos del paciente que ve su autor hasta la fecha límite de copia, que se devuelve junto a ellos
 * para que la pantalla la muestre. Todo lo del paciente es opcional.
 */
public record LegacyIdentityView(String patientName, DocumentType documentType, String documentNumber,
                                 LocalDate birthDate, String birthPlace, String address, String phone,
                                 String patientSignatureName, String guardianName, String guardianRelationship,
                                 Instant copyDeadline) {
}

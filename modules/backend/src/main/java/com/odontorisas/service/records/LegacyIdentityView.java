package com.odontorisas.service.records;

import com.odontorisas.common.DocumentType;

import java.time.LocalDate;

/** Datos antiguos del paciente que ve su autor hasta la fecha límite de copia. Todo es opcional. */
public record LegacyIdentityView(String patientName, DocumentType documentType, String documentNumber,
                                 LocalDate birthDate, String birthPlace, String address, String phone,
                                 String patientSignatureName, String guardianName, String guardianRelationship) {
}

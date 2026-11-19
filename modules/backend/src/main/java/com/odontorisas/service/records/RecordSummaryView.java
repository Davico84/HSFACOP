package com.odontorisas.service.records;


import java.time.Instant;
import java.time.LocalDate;

/** Fila del listado de historias (sin contenido clínico). */
public record RecordSummaryView(
    Long id,
    String recordNumber,
    String patientAlias,
    String treatingDentist,
    LocalDate treatmentStartDate,
    String authorName,
    String cohortName,
    Instant updatedAt,
    boolean patientLocked) {
}

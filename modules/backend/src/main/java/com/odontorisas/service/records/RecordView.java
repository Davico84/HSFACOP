package com.odontorisas.service.records;

import com.odontorisas.common.PatientSex;
import com.odontorisas.service.records.content.RecordContent;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/** Historia completa tal como la ve quien puede abrirla. */
public record RecordView(
    Long id,
    String recordNumber,
    Long authorId,
    String authorName,
    String treatingDentist,
    String patientAlias,
    PatientSex patientSex,
    Integer patientAge,
    LocalDate treatmentStartDate,
    RecordContent content,
    Integer lastStep,
    List<Integer> filledSteps,
    Instant patientLockedAt,
    String lastUnlockBy,
    Instant lastUnlockAt,
    Instant unlockRequestedAt,
    String unlockRequestReason,
    long version,
    Instant createdAt,
    Instant updatedAt) {
}

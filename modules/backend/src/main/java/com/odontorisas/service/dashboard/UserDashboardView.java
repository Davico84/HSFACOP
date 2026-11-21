package com.odontorisas.service.dashboard;

import com.odontorisas.service.records.RecordQuotaView;

import java.time.Instant;
import java.util.List;

/** Métricas de Inicio del tratante (solo sus historias). */
public record UserDashboardView(
    long total,
    long createdThisMonth,
    RecordQuotaView quota,
    DashboardService.Completeness completeness,
    List<ResumeItem> resume) {

    /**
     * Historia para retomar; {@code filledSteps} = pasos clínicos con datos, nulo = sin calcular;
     * {@code missingAge} y {@code missingTreatmentStart} = datos del paciente que le faltan.
     */
    public record ResumeItem(long id, String recordNumber, String patientName, Integer lastStep, Integer filledSteps,
                             Instant updatedAt, boolean missingAge, boolean missingTreatmentStart) {
    }
}

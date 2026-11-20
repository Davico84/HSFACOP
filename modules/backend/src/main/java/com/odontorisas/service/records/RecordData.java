package com.odontorisas.service.records;

import com.odontorisas.common.PatientSex;
import com.odontorisas.service.records.content.RecordContent;

import java.time.LocalDate;

/**
 * Datos editables de una historia (lo que envía el formulario), incluido el número que asignan los
 * docentes. El paciente se identifica solo por alias, sexo y edad escrita. El autor y la versión
 * no están aquí: los controla el servidor.
 */
public record RecordData(
    String recordNumber,
    String treatingDentist,
    String patientAlias,
    PatientSex patientSex,
    Integer patientAge,
    LocalDate treatmentStartDate,
    RecordContent content) {
}

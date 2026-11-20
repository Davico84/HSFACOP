package com.odontorisas.persistence.repository;

import com.odontorisas.common.DocumentType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.sql.Date;
import java.time.LocalDate;
import java.util.Optional;

/**
 * Lectura de los datos antiguos del paciente (nombre, documento, nacimiento, lugar, domicilio,
 * celular y nombres de firma) que el servidor ya no mapea ni escribe. Solo existe para la copia que
 * hace el autor a su libreta local hasta la fecha límite; el script administrativo los vacía y una
 * migración elimina las columnas. Nada de lo que devuelve se registra.
 */
@Repository
public class LegacyIdentityQueries {

    private final JdbcClient jdbc;

    public LegacyIdentityQueries(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<LegacyIdentityRow> find(long recordId) {
        return jdbc.sql("""
                SELECT legacy_patient_name, document_type, document_number, birth_date, birth_place, address, phone,
                       legacy_signatures ->> 'patientSignatureName' AS patient_signature_name,
                       legacy_signatures ->> 'guardianName' AS guardian_name,
                       legacy_signatures ->> 'guardianRelationship' AS guardian_relationship
                FROM orthodontic_records WHERE id = :id""")
            .param("id", recordId)
            .query((rs, i) -> {
                String type = rs.getString("document_type");
                Date birth = rs.getDate("birth_date");
                return new LegacyIdentityRow(rs.getString("legacy_patient_name"),
                    type == null ? null : DocumentType.valueOf(type), rs.getString("document_number"),
                    birth == null ? null : birth.toLocalDate(), rs.getString("birth_place"), rs.getString("address"),
                    rs.getString("phone"), rs.getString("patient_signature_name"), rs.getString("guardian_name"),
                    rs.getString("guardian_relationship"));
            }).optional();
    }

    /** Datos antiguos de una historia; todo es opcional (había historias incompletas). */
    public record LegacyIdentityRow(String patientName, DocumentType documentType, String documentNumber,
                                    LocalDate birthDate, String birthPlace, String address, String phone,
                                    String patientSignatureName, String guardianName, String guardianRelationship) {
    }
}

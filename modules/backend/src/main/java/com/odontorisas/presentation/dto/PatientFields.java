package com.odontorisas.presentation.dto;

import com.odontorisas.common.PatientSex;
import com.odontorisas.service.records.PatientAlias;
import com.odontorisas.service.records.RecordAgeCalculator;
import com.odontorisas.service.records.content.RecordContent;
import com.odontorisas.service.records.content.YesNo;
import jakarta.validation.Constraint;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import jakarta.validation.Payload;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import java.time.LocalDate;

/**
 * Datos del paciente comunes a crear y guardar una historia, con sus reglas entre campos: alias
 * de una o dos palabras, edad escrita entre 0 y 99 años, y edad de la primera menstruación entre 8
 * y 18 años, no mayor que la edad registrada; antes de los 8 años la respuesta no puede ser Sí.
 * Cada error va a su campo.
 */
public interface PatientFields {

    String patientAlias();

    PatientSex patientSex();

    Integer patientAge();

    LocalDate treatmentStartDate();

    RecordContent content();

    @Documented
    @Constraint(validatedBy = Validator.class)
    @Target(ElementType.TYPE)
    @Retention(RetentionPolicy.RUNTIME)
    @interface Consistent {
        String message() default "Datos del paciente inconsistentes.";

        Class<?>[] groups() default {};

        Class<? extends Payload>[] payload() default {};
    }

    class Validator implements ConstraintValidator<Consistent, PatientFields> {

        static final int MIN_MENARCHE_AGE = 8;
        static final int MAX_MENARCHE_AGE = 18;

        @Override
        public boolean isValid(PatientFields value, ConstraintValidatorContext context) {
            if (value == null) {
                return true;
            }
            context.disableDefaultConstraintViolation();
            boolean valid = true;
            String aliasProblem = PatientAlias.violation(value.patientAlias());
            if (aliasProblem != null) {
                valid = violation(context, "patientAlias", aliasProblem);
            }
            if (!RecordAgeCalculator.isInRange(value.patientAge())) {
                valid = violation(context, "patientAge", "Usa una edad entre 0 y 99 años.");
            }
            Integer menarcheAge = value.content() == null || value.content().anamnesis() == null
                ? null : value.content().anamnesis().menarcheAge();
            YesNo menarche = value.content() == null || value.content().anamnesis() == null
                ? null : value.content().anamnesis().menarche();
            // Solo aplica con sexo femenino y respuesta Sí (si no, el normalizador lo descarta al guardar).
            boolean applies = menarche == YesNo.YES && value.patientSex() == PatientSex.FEMALE;
            Integer age = RecordAgeCalculator.isInRange(value.patientAge()) ? value.patientAge() : null;
            if (applies && age != null && age < MIN_MENARCHE_AGE) {
                valid = anamnesisViolation(context, "menarche", "Antes de los 8 años la primera menstruación no aplica.");
            }
            if (applies && menarcheAge != null) {
                if (menarcheAge < MIN_MENARCHE_AGE || menarcheAge > MAX_MENARCHE_AGE) {
                    valid = anamnesisViolation(context, "menarcheAge", "Usa una edad entre 8 y 18 años.");
                } else if (age != null && menarcheAge > age) {
                    valid = anamnesisViolation(context, "menarcheAge",
                        "La edad de la primera menstruación no puede superar la edad registrada de la paciente.");
                }
            }
            return valid;
        }

        private static boolean anamnesisViolation(ConstraintValidatorContext context, String field, String message) {
            context.buildConstraintViolationWithTemplate(message)
                .addPropertyNode("content").addPropertyNode("anamnesis").addPropertyNode(field)
                .addConstraintViolation();
            return false;
        }

        private static boolean violation(ConstraintValidatorContext context, String field, String message) {
            context.buildConstraintViolationWithTemplate(message).addPropertyNode(field).addConstraintViolation();
            return false;
        }
    }
}

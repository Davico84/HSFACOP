package com.odontorisas.service.records.migration;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.stereotype.Component;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.util.List;

/**
 * Lanza la acción administrativa única de migración de la identidad del paciente (no es un endpoint).
 * Solo existe cuando se pide con {@code app.identity-migration.mode} ({@code list} o {@code apply}) y
 * conviene arrancarla en un puerto aleatorio solo local (sin servidor web no arranca la seguridad):
 *
 * <pre>
 * java -jar backend.jar --server.port=0 --server.address=127.0.0.1 \
 *   --app.identity-migration.mode=list
 * java -jar backend.jar --server.port=0 --server.address=127.0.0.1 \
 *   --app.identity-migration.mode=apply --app.identity-migration.backup-verified=true \
 *   --app.identity-migration.approval="aprobación escrita del 2026-12-10"
 * </pre>
 *
 * <p>{@code list} no cambia nada: muestra el alias que recibiría cada historia y los conteos. {@code apply}
 * se niega a correr sin una copia de seguridad de la base verificada ({@code backup-verified=true}), sin
 * la referencia a la aprobación escrita del responsable, antes de la fecha límite de copia y sin que el
 * operador escriba la confirmación. Escribe en la salida estándar (nunca en los registros) y solo
 * conteos, salvo en {@code list}, que muestra los alias para su revisión.
 */
@Component
@ConditionalOnProperty(prefix = "app.identity-migration", name = "mode")
public class IdentityMigrationRunner implements ApplicationRunner {

    private final IdentityMigration migration;
    private final ConfigurableApplicationContext context;
    private final String mode;
    private final boolean backupVerified;
    private final String approval;
    private final PrintStream out;
    private final BufferedReader in;

    @Autowired
    public IdentityMigrationRunner(IdentityMigration migration, ConfigurableApplicationContext context,
            org.springframework.core.env.Environment env) {
        this(migration, context, env.getProperty("app.identity-migration.mode", ""),
            env.getProperty("app.identity-migration.backup-verified", Boolean.class, false),
            env.getProperty("app.identity-migration.approval", ""), System.out,
            new BufferedReader(new InputStreamReader(System.in, StandardCharsets.UTF_8)));
    }

    IdentityMigrationRunner(IdentityMigration migration, ConfigurableApplicationContext context, String mode,
            boolean backupVerified, String approval, PrintStream out, BufferedReader in) {
        this.migration = migration;
        this.context = context;
        this.mode = mode;
        this.backupVerified = backupVerified;
        this.approval = approval;
        this.out = out;
        this.in = in;
    }

    @Override
    public void run(ApplicationArguments args) {
        int code = execute();
        System.exit(SpringApplication.exit(context, () -> code));
    }

    /** Ejecuta la acción y devuelve el código de salida: 0 bien, distinto de 0 si se negó o falló. */
    int execute() {
        try {
            switch (mode) {
                case "list" -> list();
                case "apply" -> apply();
                default -> throw new IllegalStateException("Modo desconocido: usa list o apply.");
            }
            return 0;
        } catch (IllegalStateException e) {
            out.println("NO SE MIGRÓ NADA: " + e.getMessage());
            return 2;
        } catch (RuntimeException e) {
            out.println("La acción falló (" + e.getClass().getSimpleName() + "); las historias ya migradas quedaron marcadas "
                + "y se puede reejecutar. No se muestra el detalle: puede incluir datos del paciente.");
            return 1;
        }
    }

    private void list() {
        migration.requireWindowClosed();
        List<IdentityMigration.AliasLine> lines = migration.previewAliases();
        out.println("Historias pendientes: " + lines.size());
        out.println("Alias propuestos (id, número, alias):");
        lines.forEach(line -> out.println("  " + line.id() + "  " + line.recordNumber() + "  " + line.alias()));
        report();
        out.println("Nada se cambió (modo list).");
    }

    private void apply() {
        if (!backupVerified) {
            throw new IllegalStateException("Falta confirmar la copia de seguridad verificada de la base "
                + "(--app.identity-migration.backup-verified=true).");
        }
        if (approval == null || approval.isBlank()) {
            throw new IllegalStateException("Falta la referencia a la aprobación escrita del responsable "
                + "(--app.identity-migration.approval=...).");
        }
        migration.requireWindowClosed();
        int pending = migration.pendingCount();
        report();
        out.println("Se van a migrar " + pending + " historias y a borrar sus datos antiguos del paciente (quedan solo en el papel).");
        out.println("Para continuar escribe exactamente: MIGRAR " + pending);
        String answer;
        try {
            answer = in.readLine();
        } catch (IOException e) {
            answer = null;
        }
        if (answer == null || !answer.strip().equals("MIGRAR " + pending)) {
            throw new IllegalStateException("Sin la confirmación del operador.");
        }
        IdentityMigration.Result result = migration.migrate();
        out.println("Migradas: " + result.migrated() + " · ya migradas antes: " + result.skippedAlreadyMigrated()
            + " · pendientes: " + result.remaining());
        IdentityMigration.Verification check = migration.verify();
        out.println("Verificación: historias con columnas retiradas con valor: " + check.rowsWithRetiredColumns()
            + " · con nombres de firma retirados: " + check.rowsWithRetiredSignatureNames()
            + " · con motivos en texto libre: " + check.rowsWithFreeTextUnlockReasons());
        if (!check.clean()) {
            throw new IllegalStateException("Quedan datos retirados: no se deben retirar las columnas.");
        }
        out.println("Historias con edad en contradicción con la primera menstruación: " + migration.inconsistentCount()
            + " (el siguiente guardado pide corregirlas).");
    }

    private void report() {
        migration.unbackedByAuthor().ifPresentOrElse(
            rows -> out.println("Historias pendientes sin respaldo en la libreta, por autor (solo informativo; "
                + "pasada la fecha límite se borra igual): " + rows.stream()
                    .map(row -> "autor " + row.authorId() + ": " + row.records()).toList()),
            () -> out.println("Respaldo en la libreta: aún no hay marca de respaldo (informe no disponible)."));
        out.println("Historias con edad en contradicción con la primera menstruación: " + migration.inconsistentCount());
    }
}

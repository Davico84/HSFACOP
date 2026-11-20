package com.odontorisas.infra.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/** Habilita {@link RecordsProperties} (cupo inicial de las cuentas nuevas) y {@link LegacyCopyProperties} (ventana de copia). */
@Configuration
@EnableConfigurationProperties({RecordsProperties.class, LegacyCopyProperties.class})
public class RecordsConfig {
}

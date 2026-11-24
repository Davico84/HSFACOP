package com.odontorisas.service.users;

import com.odontorisas.common.Role;
import com.odontorisas.persistence.entity.User;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Reglas del vencimiento de cuentas: bordes de día en Lima, renovación y ADMIN. */
class AccountExpiryTest {

    private static final ZoneId LIMA = ZoneId.of("America/Lima");
    private static final LocalDate TODAY = LocalDate.of(2030, 10, 15);

    private static Clock clockAt(String instant) {
        return Clock.fixed(Instant.parse(instant), LIMA);
    }

    private static User user(Role role, LocalDate expiresOn) {
        return User.builder().role(role).expiresOn(expiresOn).build();
    }

    @Test
    void last_day_is_not_expired_and_the_next_one_is() {
        User account = user(Role.USER, TODAY);
        assertThat(AccountExpiry.isExpired(account, TODAY)).isFalse();
        assertThat(AccountExpiry.isExpired(account, TODAY.plusDays(1))).isTrue();
    }

    @Test
    void admin_never_expires_even_with_a_past_date() {
        assertThat(AccountExpiry.isExpired(user(Role.ADMIN, TODAY.minusYears(1)), TODAY)).isFalse();
        assertThat(AccountExpiry.isExpired(user(Role.ADMIN, null), TODAY)).isFalse();
    }

    @Test
    void today_follows_the_lima_calendar_not_utc() {
        // 04:30 UTC del día 16 es la noche del 15 en Lima.
        assertThat(AccountExpiry.today(clockAt("2030-10-16T04:30:00Z"))).isEqualTo(TODAY);
        assertThat(AccountExpiry.today(clockAt("2030-10-16T05:00:00Z"))).isEqualTo(TODAY.plusDays(1));
    }

    @Test
    void initial_is_today_plus_12_months() {
        assertThat(AccountExpiry.initial(clockAt("2030-10-15T17:00:00Z"))).isEqualTo(LocalDate.of(2031, 10, 15));
    }

    @Test
    void renewing_an_expired_account_counts_from_today() {
        assertThat(AccountExpiry.renewed(user(Role.USER, LocalDate.of(2030, 9, 1)), TODAY)).isEqualTo(LocalDate.of(2031, 10, 15));
    }

    @Test
    void renewing_an_active_account_counts_from_its_expiry() {
        assertThat(AccountExpiry.renewed(user(Role.USER, TODAY.plusDays(20)), TODAY)).isEqualTo(TODAY.plusDays(20).plusMonths(12));
    }

    @Test
    void require_writable_throws_account_expired_with_403() {
        Clock clock = clockAt("2030-10-15T17:00:00Z");
        assertThatCode(() -> AccountExpiry.requireWritable(user(Role.USER, TODAY), clock)).doesNotThrowAnyException();
        assertThatThrownBy(() -> AccountExpiry.requireWritable(user(Role.USER, TODAY.minusDays(1)), clock))
            .isInstanceOf(AccountExpiredException.class)
            .hasMessageContaining("Tu acceso venció");
    }
}

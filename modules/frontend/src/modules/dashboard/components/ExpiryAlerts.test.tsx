import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/utils";
import { ExpiryAlerts } from "./ExpiryAlerts";

const base = { total: 12, active: 10, disabled: 2, newThisMonth: 0 };

describe("ExpiryAlerts — Inicio del ADMIN", () => {
  it("Cuentas por vencer y vencidas: muestra 1 por vencer y 1 vencida", () => {
    renderWithProviders(<ExpiryAlerts users={{ ...base, expiringSoon: 1, expired: 1 }} />);

    expect(screen.getByText("Vencidas")).toBeInTheDocument();
    expect(screen.getByText("Vencen en 30 días")).toBeInTheDocument();
  });

  it("Enlace filtrado: las vencidas abren Usuarios filtrado por vencidas", () => {
    renderWithProviders(<ExpiryAlerts users={{ ...base, expiringSoon: 2, expired: 1 }} />);

    expect(screen.getByRole("link", { name: /Ver vencidas/ })).toHaveAttribute("href", "/usuarios?vencimiento=vencidas");
    expect(screen.getByRole("link", { name: /Ver por vencer/ })).toHaveAttribute("href", "/usuarios?vencimiento=por-vencer");
  });

  it("Nada por vencer: indica que no hay cuentas por renovar", () => {
    renderWithProviders(<ExpiryAlerts users={{ ...base, expiringSoon: 0, expired: 0 }} />);

    expect(screen.getByText("No hay cuentas por renovar.")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});

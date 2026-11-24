import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ExpiredAccountBanner } from "./ExpiredAccountBanner";

describe("ExpiredAccountBanner", () => {
  it("Aviso y controles: muestra la fecha, que puede ver e imprimir y a quién pedir la renovación", () => {
    render(<ExpiredAccountBanner expiresOn="2026-11-23" />);

    const banner = screen.getByRole("status");
    expect(banner).toHaveTextContent("Tu acceso venció el 23/11/2026.");
    expect(banner).toHaveTextContent("Puedes ver e imprimir tus historias");
    expect(banner).toHaveTextContent("pide la renovación al administrador");
  });
});

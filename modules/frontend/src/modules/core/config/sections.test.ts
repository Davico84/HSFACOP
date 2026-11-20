import { describe, it, expect } from "vitest";
import { canAccess, sectionById, sections, type SectionConfig } from "./sections";
import { navItemsFor } from "@/modules/core/components/shell/navItems";

describe("sections — una sola fuente de verdad", () => {
  it("ids y rutas son únicos (una ruta no puede tener dos políticas)", () => {
    expect(new Set(sections.map((s) => s.id)).size).toBe(sections.length);
    expect(new Set(sections.map((s) => s.path)).size).toBe(sections.length);
  });

  it("sectionById devuelve la sección declarada", () => {
    expect(sectionById("users")).toMatchObject({ path: "/usuarios", roles: ["ADMIN"] });
  });

  it("canAccess: sin roles cualquiera; con roles solo los listados", () => {
    expect(canAccess(sectionById("notebook"), "USER")).toBe(true);
    expect(canAccess(sectionById("notebook"), "ADMIN")).toBe(true);
    expect(canAccess(sectionById("users"), "USER")).toBe(false);
    expect(canAccess(sectionById("users"), "ADMIN")).toBe(true);
  });

  it("los roles salen del contrato: uno mal escrito no compila", () => {
    // @ts-expect-error "ADMN" no es un UserResponseRole (si compilara, typecheck fallaría aquí)
    const typo: SectionConfig = { id: "users", path: "/x", roles: ["ADMN"] };
    expect(typo).toBeDefined();
  });

  it("navItemsFor filtra por rol y toma la ruta de la sección", () => {
    expect(navItemsFor("USER").map((i) => i.label)).toEqual(["Inicio", "Historias clínicas", "Mi libreta", "Mis datos"]);
    expect(navItemsFor("ADMIN").map((i) => [i.label, i.to])).toEqual([
      ["Inicio", "/"],
      ["Historias clínicas", "/historias"],
      ["Mi libreta", "/libreta"],
      ["Usuarios", "/usuarios"],
      ["Mis datos", "/mis-datos"],
    ]);
  });
});

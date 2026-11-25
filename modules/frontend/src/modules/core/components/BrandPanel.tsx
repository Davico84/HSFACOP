import { project } from "@/config/project";
import { ContactLinks } from "@/modules/core/components/ContactLinks";

/**
 * Panel de marca de las pantallas a pantalla completa (login, registro, arranque en frío): Roxo
 * liso (token brand-start) con tagline, descripción y contacto de project.config.json. Sin logo ni
 * línea de derechos: las pantallas previas al ingreso no llevan la marca de la institución. Solo en
 * escritorio.
 */
export function BrandPanel() {
  return (
    <aside className="relative hidden flex-col justify-center bg-brand-start p-12 text-white lg:flex">
      <div className="max-w-md">
        <h2 className="text-balance text-3xl font-semibold leading-tight">{project.tagline}</h2>
        <p className="mt-3 text-white/80">{project.description}</p>
        <ContactLinks tone="onBrand" className="mt-8 border-t border-white/20 pt-5" />
      </div>
    </aside>
  );
}

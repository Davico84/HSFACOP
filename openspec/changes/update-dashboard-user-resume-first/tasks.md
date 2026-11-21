# Tasks

## 1. Backend: respuesta de `GET /api/dashboard/me`

- [x] 1.1 `DashboardQueries.resume` devuelve en cada fila `missingAge` (`patient_age IS NULL`) y `missingTreatmentStart` (`treatment_start_date IS NULL`); `UserDashboardView.ResumeItem` y `DashboardResumeItem` (DTO) los exponen; verificar en `DashboardIT` con los Scenario "Datos faltantes", "Falta solo la fecha de inicio" e "Historia con todos los datos"
- [x] 1.2 Retirar de la respuesta del tratante `missing` (`withoutAge`, `withoutTreatmentStart`, `emptySteps`) y `completeness.averageFilledSteps`: quitar el DTO y `UserDashboardView.Missing`/`EmptyStep`, el ordenamiento de pasos vacíos en `DashboardService.forUser` y las agregaciones que solo ellos usaban en `recordTotals`; antes de borrar `average_filled`, confirmar que el Inicio del `ADMIN` no lo lee (usa `topAuthors`); verificar con `mvn verify` en verde (incluida ArchUnit) y con `DashboardIT` sobre los Scenario "Historias y cupo", "Completas y por terminar", "Firmas no cuenta", "Historias sin calcular" y "Datos faltantes" (la respuesta ya no trae esos campos)
- [x] 1.3 Comprobar que el Inicio del `ADMIN` y el de coordinación no cambian: las pruebas existentes de `DashboardIT` y `DashboardControllerTest` para `ADMIN` y coordinación pasan sin tocarlas; verificar con `mvn verify`
- [x] 1.4 Actualizar `contracts/openapi.json` con `-Dcontract.update=true` y revisar el diff (solo los campos de `me` y los dos del resume); verificar que la guarda de deriva pasa sin la bandera

## 2. Frontend: cliente de la API

- [x] 2.1 Regenerar el cliente con `pnpm generate:api`; verificar que `userDashboardResponse.ts`, `dashboardResumeItem.ts` y `userDashboardCompleteness.ts` cambian solo como en el contrato y que `userDashboardMissing.ts` y `dashboardEmptyStep.ts` desaparecen (`git diff` y `pnpm typecheck`)

## 3. Frontend: Inicio del tratante

Antes de escribir: `docs/frontend.md` §1 y §4.1 (skill `frontend-guard`); un archivo = un componente; solo tokens (sin colores literales); texto de interfaz en español.

- [x] 3.1 `DashboardFeature`/`UserDashboard`: encabezado con el saludo y `NewRecordLink` a la derecha (en celular, debajo y a ancho completo) para el `USER` con historias; el `ADMIN` y la coordinación conservan su encabezado; verificar con los Scenario "Historias y cupo", "Cupo lleno" y "Sin historias todavía" (Vitest + MSW: botón presente, deshabilitado con el aviso con cupo lleno, `DashboardEmpty` sin historias)
- [x] 3.2 `ResumeList` a todo el ancho y primera sección: fila con número · alias, "X de 7 pasos con datos" solo si `filledSteps` no es nulo, fecha, avisos "Falta la edad" / "Falta la fecha de inicio" en tono neutro y botón "Continuar en paso N" (`aria-label` con el número de historia); verificar con los Scenario "Retomar una historia", "Retomar sin último paso", "Historia sin avance calculado", "Datos faltantes", "Falta solo la fecha de inicio", "Historia con todos los datos", "Todas completas" y "Orden de la pantalla"
- [x] 3.3 Dos `StatCard` bajo la lista: **Cupo** ("N de M" o "Sin límite") y **Completas** con la pista "N por terminar" (`inProgress + notComputed`); sin promedio ni aviso de "sin calcular"; verificar con los Scenario "Completas y por terminar", "Firmas no cuenta" e "Historias sin calcular" (el texto "sin calcular" no aparece en pantalla)
- [x] 3.4 Eliminar `MissingData.tsx` y sus usos, y las funciones de `utils/format` que queden sin uso (`formatAverage`, etc., solo si ninguna otra pantalla las usa); verificar con `grep` de referencias, `pnpm typecheck` y `pnpm lint` (sin importaciones muertas)
- [x] 3.5 Revisar en el navegador (claro y oscuro, escritorio y celular de 360 px) que el botón y los avisos no se cortan, que los avisos no usan color de error y que se ve igual de bien sin historias; verificar con capturas guardadas fuera del repo

## 4. Cierre

- [x] 4.1 `pnpm validate` (typecheck + lint + test) y `mvn verify` en verde; `openspec validate update-dashboard-user-resume-first --strict` sin errores
- [ ] 4.2 Actualizar `docs/vision.md` ("Estado de capacidades": change en progreso al proponer; capacidad construida y enlace a `specs/dashboard/spec.md` al archivar); verificar que el enlace existe

## Workflow follow-up

- Revisión humana del proposal y del delta antes de `/opsx:apply`.
- Archivar este change **después** de `update-orthodontic-records-pseudonymous-patient` (ver D6 en `design.md`); en el mismo commit, `docs/vision.md`.
- Ramas: `change/update-dashboard-user-resume-first` desde `main`; backend y frontend en commits separados (`docs/commits.md`).

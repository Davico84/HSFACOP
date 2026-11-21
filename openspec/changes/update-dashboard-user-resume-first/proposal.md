## Why

El Inicio del tratante (`USER`) abre con cuatro tarjetas de números iguales (historias, cupo, completas, promedio de pasos) y, debajo, "Para retomar" y "Datos faltantes". Lo que el tratante necesita al abrirlo es continuar su trabajo o crear una historia, y suele hacerlo entre pacientes y desde el celular. Hoy lo más útil queda a media altura y detrás de métricas que no cambian lo que hace a continuación; "Datos faltantes" muestra siete barras casi iguales, en rosa saturado, que se leen como reproche. La crítica de diseño del 2026-11-20 (impeccable) lo marcó como el problema principal del Inicio.

## What Changes

- **Retomar primero:** "Para retomar" pasa al primer plano, a todo el ancho. Cada historia tiene un botón "Continuar en paso N" (antes un enlace de texto "Paso N").
- **Crear sin ir al menú:** "Nueva historia" aparece junto al saludo. Con el cupo lleno queda deshabilitado y dice por qué (la misma regla de la lista de historias).
- **Dos indicadores en vez de cuatro:** Inicio del `USER` muestra **Cupo** y **Completas** (con "por terminar" como pista). Se retiran "Historias" y "Promedio de pasos".
- **Faltantes por historia:** "Datos faltantes" desaparece como tarjeta. Cada fila de "Para retomar" indica, si corresponde, "Falta la edad" y/o "Falta la fecha de inicio". Se retira de la vista del tratante la lista de "pasos vacíos".
- **Sin jerga interna:** se quita "N sin calcular: se calculan al volver a guardarlas"; una historia sin avance calculado se cuenta como "por terminar" y su fila no muestra "Sin calcular". La pista del avance pasa a "X de 7 pasos con datos" sin aclaraciones de implementación.
- **BREAKING (solo contrato interno):** `GET /api/dashboard/me` deja de devolver `missing.emptySteps`, `missing.withoutAge`, `missing.withoutTreatmentStart` y `completeness.averageFilledSteps`, y cada elemento de `resume` suma `missingAge` y `missingTreatmentStart`. Solo lo consume esta aplicación; el cliente se regenera. Se retiran también las consultas que los calculaban.
- No cambian el Inicio del `ADMIN`, el de coordinación ni la hoja impresa.

## Capabilities

### New Capabilities
- Ninguna.

### Modified Capabilities
- `dashboard`: requisitos del tratante — métricas en Inicio (cupo y "Nueva historia"), completitud (sin promedio ni aviso de "sin calcular"), datos faltantes (por historia, en lugar de conteos y pasos vacíos) e historias para retomar (botón "Continuar en paso N").

## Impact

- **Backend:** `DashboardQueries` (retira los conteos y los pasos vacíos; el listado de retomar suma dos banderas), `DashboardService`, `UserDashboardView`, `UserDashboardResponse`, `DashboardResumeItem`; prueba de integración del tablero; `contracts/openapi.json` (guarda de deriva).
- **Frontend:** `UserDashboard`, `ResumeList`, `MissingData` (se elimina), `StatCard`, pruebas del Inicio; cliente de la API regenerado con `pnpm generate:api`.
- **Docs:** `docs/vision.md` (estado del cambio en curso; al archivar, capacidad construida).
- **Relación con otros changes:** `update-orthodontic-records-pseudonymous-patient` ya modifica "Datos faltantes en las historias del tratante" (de "sin documento / sin fecha de nacimiento" a "sin edad / sin fecha de inicio") y aún no está archivado. Este change reescribe ese mismo requisito, así que **debe archivarse después de aquel**: su `MODIFIED` parte del texto que deja el otro.

## Non-goals

- Rediseñar el Inicio del `ADMIN` o el de coordinación.
- Cambiar cómo se calcula "completa" (7 pasos clínicos con datos; Firmas no cuenta) ni qué historias entran en "Para retomar".
- Cambiar los nombres del dominio ("turma", "alias", "tratante").
- Tocar la hoja impresa, los tokens de color o el modo oscuro.

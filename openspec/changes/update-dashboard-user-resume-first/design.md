# Design

## Context

Ver `proposal.md` (Why). Estado actual, verificado en el código:

- `GET /api/dashboard/me` (`DashboardService.forUser`) devuelve `records`, `quota`, `completeness` (`complete`, `inProgress`, `notComputed`, `averageFilledSteps`), `missing` (`withoutAge`, `withoutTreatmentStart`, `emptySteps` con los 7 pasos) y `resume` (hasta 5 historias no completas: `id`, `recordNumber`, `patientName`, `lastStep`, `filledSteps`, `updatedAt`).
- `DashboardQueries.recordTotals(authorId, monthStart)` es **compartida** con el Inicio del `ADMIN` (`authorId = null`): calcula en una sola consulta los totales, el promedio, los conteos de faltantes y los pasos vacíos.
- El frontend arma el Inicio en `UserDashboard` (cuatro `StatCard`, luego `ResumeList` y `MissingData` en dos columnas). `NewRecordLink` ya resuelve el cupo lleno (deshabilitado con tooltip y `aria-label`).
- "Completa" = datos en los 7 pasos clínicos (máscara `127`); Firmas (paso 8) no cuenta. `filled_steps` es nulo en las historias guardadas antes del cálculo del avance ("sin calcular").
- `update-orthodontic-records-pseudonymous-patient` (sin archivar) ya modifica el requisito "Datos faltantes en las historias del tratante": de documento y nacimiento a edad y fecha de inicio. El código ya cuenta `withoutAge`.

## Goals / Non-Goals

**Goals:**
- Que lo primero del Inicio sea continuar o crear una historia, también en celular.
- Que el aviso de datos faltantes sea una acción por historia, no un conteo.
- Retirar del contrato lo que ninguna pantalla va a leer.

**Non-Goals:**
- Tocar el Inicio de `ADMIN` o de coordinación, la hoja impresa, los tokens o el modo oscuro.
- Mostrar faltantes de historias **completas** (ver Riesgos).

## Decisions

### D1. Los faltantes viajan en cada elemento de `resume`, no como conteos
`DashboardResumeItem` suma `missingAge: boolean` y `missingTreatmentStart: boolean` (`patient_age IS NULL`, `treatment_start_date IS NULL`), calculados en la misma consulta `resume`. No hay consulta nueva ni segundo viaje.
*Alternativa descartada:* dejar los conteos y pintar chips en la interfaz — mantiene el reproche agregado ("1 sin edad") sin decir cuál historia, que es justo lo que se critica.

### D2. Se retira `missing` y `averageFilledSteps` de `GET /api/dashboard/me`
Ninguna pantalla los leería. Se quitan del DTO y de `UserDashboardView`; se eliminan el ordenamiento de pasos vacíos en `DashboardService` y las agregaciones `without_age`, `without_treatment_start`, `average_filled` y `empty_1..7` de `recordTotals`. Antes de borrar `average_filled` se comprueba que el Inicio del `ADMIN` no lo use (usa `topAuthors`, con su propia consulta); si lo usara, se deja solo para él.
*Alternativa descartada:* conservar los campos "por compatibilidad" — el único cliente es esta SPA y se regenera con el contrato; dejar campos muertos cuesta una consulta más pesada en cada carga del Inicio.
*Contrato:* `contracts/openapi.json` cambia (BREAKING interno); la guarda de deriva (`-Dcontract.update=true`) y `pnpm generate:api` lo reflejan.

### D3. "Por terminar" se calcula en el cliente
La API sigue entregando `complete`, `inProgress` y `notComputed`; la interfaz muestra `inProgress + notComputed` como "por terminar". No se crea un campo derivado: es una suma de dos números ya entregados y evita otro cambio de contrato.

### D4. Orden y composición de Inicio (solo `USER` con historias)
1. Encabezado: saludo + `NewRecordLink` a la derecha (en celular, debajo del saludo, ancho completo).
2. `ResumeList` a todo el ancho, primera sección.
3. Fila compacta con dos `StatCard`: **Cupo** y **Completas** (pista: "N por terminar"; con cupo lleno, el aviso del cupo).
Sin historias se mantiene `DashboardEmpty`. `MissingData` se elimina (un archivo = un componente; sin uso).
Cada fila de `ResumeList`: número · alias; "X de 7 pasos con datos" (solo si `filledSteps` no es nulo) y fecha; avisos "Falta la edad" / "Falta la fecha de inicio" como texto con icono, en tono neutro (`text-muted-foreground`, sin color de error ni de advertencia saturado); botón "Continuar en paso N" (`Button` variante `secondary`, enlace con `asChild` o `buttonVariants`) con `aria-label` que incluye el número de historia, igual que hoy.

### D5. Copy
"Avance" sin jerga: "X de 7 pasos con datos". Se retiran "Sin calcular", "Firmas no cuenta" y "calculadas". Los textos van en la interfaz; los scenarios del spec fijan los visibles.

### D6. Orden de archivado
Este change reescribe "Datos faltantes en las historias del tratante" sobre el texto que deja `update-orthodontic-records-pseudonymous-patient`. Se archiva **después** de ese; si no, `MODIFIED` partiría de un requisito con "documento / fecha de nacimiento".

## Risks / Trade-offs

- **Una historia completa sin edad o sin fecha de inicio ya no se avisa** (antes contaba en "Sin edad N") → la edad es opcional desde el change del alias y la fecha de inicio se pide en el paso 1; si se vuelve un problema real, se agrega después un aviso en la lista de historias, no en Inicio.
- **El tratante deja de ver cuántas historias llevaba creadas en el mes** → sigue en la lista de historias y en la API; no se usaba para decidir nada.
- **Quitar campos del contrato** puede romper un cliente que no sea esta SPA → no hay otros clientes; el cambio va en la misma entrega que la regeneración del cliente.
- **Las filas de "Para retomar" crecen** con avisos y botón → se limita a 5 (ya está) y en celular el botón pasa a ancho completo bajo el texto.

## Migration Plan

Sin migración de datos. Se despliega backend y frontend en la misma entrega (el frontend nuevo lee `missingAge`/`missingTreatmentStart`; el viejo, `missing`). Reversible revirtiendo ambos.

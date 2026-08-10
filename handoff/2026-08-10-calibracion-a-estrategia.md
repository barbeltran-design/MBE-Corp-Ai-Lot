# Handoff — Calibración movida de Partida a Estrategia

**Fecha:** 2026-08-10
**Estado:** Implementación completa, sin commit/push (pendiente de revisión del usuario).
**Repo:** `barbeltran-design/MBE-Corpilot-AI` — ruta local `handoff/mbe-ai-copilot-source-v2/mbe-work/MBE-Corpilot-AI`.

## Objetivo

Mover "Misión 3 — Calibración Inicial" del Mundo de Partida al Mundo de la
Estrategia (como Misión 0), dejando Partida con solo 2 misiones y
renumerando Estrategia como Misiones 0-6, sin tocar URLs, el botón "Volver
al mapa" ni el mapa glassmorphism.

## Cambios por archivo

### `src/lib/worlds.ts`
- `MISIONES_PART_LABELS`: se eliminó la entrada `n: 3` (Calibración Inicial).
  Quedan solo `n: 1` (Evaluación de Madurez, +10, `/dashboard`) y `n: 2`
  (Objetivos Estratégicos, +15, `/babel/indicadores`), y `n: 2` ahora lleva
  `final: true` y `sello: 'Tablero'` (antes eso vivía en la misión 3).
- `SUBMUNDOS_ESTRATEGIA_LABELS`: se agregó `n: 0` "Calibración"/"Calibration"
  (icon ⭐, ruta `/babel/calibracion`, +25 pts, `estado: 'listo'` base). Las
  misiones 1-6 conservan sus mismos estados (listo/listo/listo/listo/wip/
  pendiente); solo se corrigieron los títulos en inglés de n:1, 4, 5 y 6
  para que coincidan literalmente con el español.

### `src/components/worlds/WorldsBuilder.tsx`
- Nuevo import `getBabelSessionIfExists` de `@/lib/babel-session` + estado
  `fase0Aprobada` + un `useEffect` que lee `phases` de la sesión de Babel
  del usuario y lo marca `true` si existe `{phase: 0, approved: true}`.
- En el render de Estrategia, cada tarjeta calcula
  `estadoEfectivo = s.n === 0 && fase0Aprobada ? 'completada' : s.estado`.
  Se agregó el badge `'completada'` (azul cielo) reutilizando la traducción
  `I.completadaTag`. Las misiones 1-6 nunca se recalculan — usan siempre su
  `estado` estático de `worlds.ts`.
- El desbloqueo del Tablero de Retos (antes hardcodeado como `n === 3`) es
  ahora dinámico vía `MISIONES_PART_LABELS.length`, en cuatro lugares:
  `completarMision`, la barra de progreso del mapa, la tarjeta teaser de
  "Mundo de Partida" y los pasos del `PageTour`.
- Textos actualizados: `mundoPartidaDesc` (menciona 2 misiones),
  `reqTablero` (ahora pide «Objetivos Estratégicos»), `tableroLockedDesc`
  (genérico, ya no menciona Calibración Inicial).

### `src/app/api/worlds/route.ts`
- `GET`: el filtro de progreso válido usa `n <= MISIONES_PART_LABELS.length`
  (antes `<= 3`).
- `POST completar-mision`: la validación de misión usa
  `MISIONES_PART_LABELS.map(m => m.n)` (antes `[1, 2, 3]`); el desbloqueo del
  Tablero usa `esFinalPartida = mision === MISIONES_PART_LABELS.length`
  (antes `mision === 3`), tanto para el flag `tablero` guardado en Firestore
  como para el campo `desbloqueo` de la respuesta.

### `src/types/firestore.ts`
- Se actualizó el comentario de `UserDoc.worlds` (1-2 misiones; el
  desbloqueo del Tablero ahora ocurre al cerrar la misión 2, "Objetivos
  Estratégicos", en vez de la extinta misión 3). El shape del tipo
  (`{ partida?: number[]; tablero?: boolean }`) no cambió.

### `docs/knowledge/MUNDOS.md` (nuevo)
Documentación de referencia: sistema de Vistas, tabla de las 2 misiones de
Partida, tabla de las 7 misiones (0-6) de Estrategia, cómo se calcula el
estado dinámico de la Misión 0, y qué explícitamente no cambió.

### `handoff/mbe-ai-copilot-source-v2/mbe-work/CLAUDE.md`
Se agregó una entrada nueva al principio de la bitácora de sesión (fuera de
este repo) siguiendo la convención existente, con el mismo detalle que este
documento.

## Qué NO cambió (a propósito)

- Las URLs `/worlds?v=partida` y `/worlds?v=estrategia` y el mecanismo de
  lectura del parámetro `?v=` en `WorldsBuilder.tsx`.
- El botón "Volver al mapa" (`setVista('mapa')`).
- El mapa glassmorphism / "Mapa Mario" (`WorldMap.tsx`, `PUNTOS_RECORRIDO`).
- `src/messages/es.json` / `en.json` — no tienen (ni necesitaban) claves de
  worlds; `WorldsBuilder.tsx` usa su propio diccionario local `I`.
- La ruta real `/babel/calibracion` (Fase 0 de Babel) y su propia UI de
  chat (`BabelPageChat.tsx`) — solo se **leen** sus datos de aprobación vía
  `getBabelSessionIfExists`, no se tocó ningún archivo de Babel.

## Verificación

`npm run build` **no se pudo ejecutar dentro de este sandbox de Cowork**:

1. El `node_modules` del repo está instalado para Windows — el shim
   `node_modules/.bin/next` intenta `exec node.exe`, que no existe en este
   Linux sandbox (`exec: node.exe: not found`).
2. Invocando el build directo (`node node_modules/next/dist/bin/next
   build`), el proceso arrancó correctamente (confirmado con `ps aux`) pero
   no terminó dentro del límite de ~178 segundos por llamada de este
   sandbox. Un segundo intento en background murió al cerrarse la llamada
   de bash que lo lanzó (los procesos no sobreviven entre llamadas
   separadas del sandbox).
3. Incluso `tsc --noEmit` (más rápido que un build completo) tampoco
   terminó en 170s — el filesystem montado en red de este entorno es lento
   (un `find` sobre solo 134 archivos de `src/` tardó ~2 segundos), lo cual
   apunta a que el cuello de botella es I/O del sandbox, no el tamaño del
   proyecto.

Esto **no es un problema del código** — es una limitación de este entorno
de ejecución específico. En su lugar se hizo verificación manual:

- Relectura completa de `WorldsBuilder.tsx` (790 líneas): sintaxis
  correcta, JSX balanceado, tipos coherentes con `worlds.ts` y
  `babel-session.ts`.
- `grep -rn "Calibración Inicial\|Initial Calibration" src/` → 0
  coincidencias en el código de worlds (las únicas coincidencias restantes
  son en `BabelPageChat.tsx` y `babel-constants.ts`, el encabezado propio de
  la Fase 0 del chat de Babel — una feature distinta, no tocada).
- `grep -rn "mision === 3\|n === 3\|=== 3)" src/lib/worlds.ts
  src/components/worlds/WorldsBuilder.tsx src/app/api/worlds/route.ts` → 0
  coincidencias (no quedó ningún `3` hardcodeado).
- Conteo manual de arreglos: `MISIONES_PART_LABELS.length === 2`,
  `SUBMUNDOS_ESTRATEGIA_LABELS.length === 7` (n = 0..6).
- Firma de `getBabelSessionIfExists(uid: string): Promise<SessionDoc |
  null>` en `src/lib/babel-session.ts` confirmada compatible con el nuevo
  uso en `WorldsBuilder.tsx`.

## Pendiente para el usuario

1. Correr `npm run build` en tu máquina local (debería ser rápido ahí, con
   el `node_modules` nativo de Windows) para tener la confirmación real que
   este sandbox no pudo dar.
2. Abrir `/es/worlds?v=partida` y confirmar 2 tarjetas (Evaluación de
   Madurez, Objetivos Estratégicos).
3. Abrir `/es/worlds?v=estrategia` y confirmar 7 tarjetas (0. Calibración
   … 6. Plan de Acción Socioambiental), y que un usuario con la Fase 0 de
   Babel ya aprobada vea la Misión 0 en estado "Completada".
4. Si todo se ve bien: `git add`, `git commit`, `git push` (yo no ejecuté
   ningún comando de git en esta sesión).

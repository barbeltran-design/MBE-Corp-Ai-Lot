# MBE Worlds — Mundo de Partida y Mundo de la Estrategia

Gamificación construida sobre la infraestructura de puntos del Club
(`src/lib/club.ts`). Página: `/[locale]/worlds` (`src/app/[locale]/worlds/page.tsx`),
componente único: `src/components/worlds/WorldsBuilder.tsx`. Datos estáticos de
las misiones: `src/lib/worlds.ts`. API de progreso: `src/app/api/worlds/route.ts`.

## Vistas

`WorldsBuilder.tsx` maneja un único estado de vista `Vista = 'mapa' | 'partida' |
'tablero' | 'estrategia'`, cambiado por botones o por el parámetro de URL
`?v=partida|tablero|estrategia` (leído en un `useEffect` al montar). Solo
`/worlds` es una ruta real de Next.js; `partida`/`tablero`/`estrategia` son
vistas cliente dentro de ese único componente, no rutas propias.

## Mundo de Partida — 2 misiones

Fuente: `MISIONES_PART_LABELS` en `src/lib/worlds.ts`.

| # | Misión | Puntos | Ruta | Nota |
|---|---|---|---|---|
| 1 | Evaluación de Madurez | +10 | `/dashboard` | Repetible cada vez que cambie la empresa (insignia Reevaluado) |
| 2 | Objetivos Estratégicos | +15 | `/babel/indicadores` | **Final**: al completarla se desbloquea el Tablero de Retos |

El progreso del usuario se guarda en `users/{uid}.worlds = { partida: number[],
tablero: boolean }` (Firestore). El desbloqueo del Tablero de Retos ya **no**
depende de completar 3 misiones (la antigua "Misión 3 — Calibración Inicial"
se movió al Mundo de la Estrategia, ver abajo): ahora se dispara al completar
la última misión del arreglo, calculada dinámicamente como
`MISIONES_PART_LABELS.length` (actualmente 2) tanto en `WorldsBuilder.tsx`
como en `src/app/api/worlds/route.ts` — no hay ningún `3` hardcodeado.

## Mundo de la Estrategia — Misiones 0-6

Fuente: `SUBMUNDOS_ESTRATEGIA_LABELS` en `src/lib/worlds.ts`. A diferencia del
Mundo de Partida, este mundo es 100% estático (sin tracking por usuario en
Firestore) **excepto** la Misión 0, cuyo estado se calcula en vivo.

| # | Misión | Puntos | Ruta | Estado |
|---|---|---|---|---|
| 0 | Calibración | +25 | `/babel/calibracion` | Dinámico: `COMPLETADA` si la Fase 0 de Babel está aprobada, `LISTO` en caso contrario |
| 1 | Propósito y Propuesta de Valor (Fase 1) | +25 | `/babel/proposito` | LISTO |
| 2 | El Entorno (Fase 2) | +25 | `/babel/entorno` | LISTO |
| 3 | Mis Capacidades (Fase 3) | +25 | `/babel/capacidades` | LISTO |
| 4 | El Enfoque Estratégico (Fase 4) | +25 | `/babel/enfoque` | LISTO |
| 5 | Organigrama y Roles | +25 | `/babel/organigrama` | EN CURSO |
| 6 | Plan de Acción Socioambiental | +25 | `/babel/plan-accion` | PENDIENTE |

La Misión 0 (Calibración) es la que antes vivía en el Mundo de Partida como
"Misión 3 — Calibración Inicial". Ahora abre la misma ruta real
(`/babel/calibracion`, Fase 0 de Babel) pero como la primera misión del Mundo
de la Estrategia.

### Estado dinámico de la Misión 0

`WorldsBuilder.tsx` lee la sesión de Babel del usuario con
`getBabelSessionIfExists(uid)` (`src/lib/babel-session.ts`) y revisa su
arreglo `phases: BabelPhaseRecord[]` en busca de un registro
`{ phase: 0, approved: true }`. Si existe, la tarjeta de la Misión 0 muestra
la etiqueta `COMPLETADA`/`Completed`; si no, muestra `LISTO`/`Ready` (el
estado base declarado en `worlds.ts`). Las misiones 1-6 conservan siempre su
`estado` estático tal como está declarado en `SUBMUNDOS_ESTRATEGIA_LABELS` —
no se recalculan en tiempo real.

## Qué NO cambió

- Las URLs (`/worlds?v=partida`, `/worlds?v=estrategia`) y el mecanismo de
  lectura del parámetro `?v=` en `WorldsBuilder.tsx`.
- El botón "Volver al mapa" (`setVista('mapa')`).
- El mapa glassmorphism / "Mapa Mario" (`src/components/worlds/WorldMap.tsx`,
  `PUNTOS_RECORRIDO`) — sus puntos "Mundo de Partida" y "Mundo de la
  Estrategia" son etiquetas genéricas del recorrido, no dependen del número
  de misiones de cada mundo.

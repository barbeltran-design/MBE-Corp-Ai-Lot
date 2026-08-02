// Constantes compartidas por la ruta de servidor (/api/babel/route.ts), los
// helpers de Firestore (babel-session.ts) y la UI de chat (babel/page.tsx).
//
// OJO: las preguntas de aprobación de abajo deben coincidir EXACTAMENTE con
// las que Gemini escribe al cerrar cada fase en route.ts (está duplicado ahí
// a propósito para no tener que importar entre server route y lib; si se
// edita el texto de alguna pregunta en route.ts, hay que actualizar también
// esta función).

// Pregunta de aprobación por fase. La Fase 4 (última) usa una redacción
// distinta ("¿Apruebas este resumen de la Fase 4?", sin "para continuar a la
// Fase X") porque no hay una Fase 5 a la que avanzar — después de aprobarla,
// el usuario usa /compilar.
export function babelApprovalQuestion(language: 'es' | 'en', phase: number): string {
  const safePhase = Number.isFinite(phase) ? Math.min(Math.max(Math.trunc(phase), 0), 4) : 0;
  if (safePhase >= 4) {
    return language === 'en'
      ? 'Do you approve this Phase 4 summary?'
      : '¿Apruebas este resumen de la Fase 4?';
  }
  return language === 'en'
    ? `Do you approve this Phase ${safePhase} summary to move on to Phase ${safePhase + 1}?`
    : `¿Apruebas este resumen de la Fase ${safePhase} para continuar a la Fase ${safePhase + 1}?`;
}

// Substring genérico usado por el cliente para detectar, en el ÚLTIMO mensaje
// de Babel, si está pidiendo aprobación — sin importar el número de fase. Más
// robusto que comparar la pregunta completa (que cambia por fase).
export function babelApprovalMarker(language: 'es' | 'en'): string {
  return language === 'en' ? 'Do you approve this Phase' : '¿Apruebas este resumen de la Fase';
}

/** Cuántas fases (0-4) ya tienen un system prompt real de Gemini escrito en
 * route.ts. Las 5 fases (0 a 4) están completas. */
export const BABEL_IMPLEMENTED_PHASES = 5;

export const BABEL_PHASE_TOPICS_ES = [
  'Fase 0: Calibración inicial',
  'Fase 1: ADN Estratégico y Propósito',
  'Fase 2: Análisis del entorno',
  'Fase 3: Capacidades Clave',
  'Fase 4: Estrategia',
] as const;

export const BABEL_PHASE_TOPICS_EN = [
  'Phase 0: Initial Calibration',
  'Phase 1: Strategic DNA and Purpose',
  'Phase 2: Environment Analysis',
  'Phase 3: Key Capabilities',
  'Phase 4: Strategy',
] as const;

export function babelPhaseTopics(language: 'es' | 'en'): readonly string[] {
  return language === 'en' ? BABEL_PHASE_TOPICS_EN : BABEL_PHASE_TOPICS_ES;
}

// Reimplementación en código de las fórmulas de la hoja "Diagnóstico
// Inicial" (columnas D/F/H/J/L/N = puntos por respuesta, O = % Madurez por
// tema, P = Nivel de Madurez por tema, fila 6 = % Avance por nivel).
//
// Dos correcciones deliberadas frente al archivo original, confirmadas con el
// usuario antes de implementarlas:
//  1. El promedio general de la hoja (celda P5, `=AVERAGE(O8:O24)`) solo
//     cubre 9 de los 11 temas. Aquí el promedio general SÍ incluye los 11.
//  2. Las fórmulas Q20/S20 de la hoja tienen un error de referencia (#REF!).
//     Aquí no reusamos las fórmulas de Excel literalmente, recalculamos
//     "niveles superados / en progreso / pendientes" desde las respuestas.
//
// computeResults() recibe la lista de dimensiones YA en el idioma del
// usuario (ver getMaturityDimensions en maturity-dimensions.ts) — los
// nombres de tema/descripciones que devuelve vienen en ese idioma, pero los
// puntajes y niveles son idénticos sin importar el idioma en el que se
// contestó, porque solo dependen de las respuestas (yes/partial/no), no del
// texto mostrado.
import type { AssessmentDoc, DimensionScore, MaturityLevel } from '@/types/firestore';
import { DIMENSION_IDS, type DimensionId, type MaturityDimensionDef } from '@/lib/maturity-dimensions';

export type Answer = 'yes' | 'partial' | 'no';
export type DimensionAnswers = Record<DimensionId, (Answer | null)[]>; // 6 valores por tema, en el orden de `levels`

export function emptyAnswers(): DimensionAnswers {
  const result = {} as DimensionAnswers;
  for (const id of DIMENSION_IDS) {
    result[id] = new Array(6).fill(null);
  }
  return result;
}

export function isComplete(answers: DimensionAnswers): boolean {
  return DIMENSION_IDS.every((id) => answers[id].every((a) => a !== null));
}

// No -> 0, Parcialmente -> mitad de maxPoints, Sí -> maxPoints.
function scoreForAnswer(answer: Answer | null, maxPoints: number): number {
  if (answer === 'yes') return maxPoints;
  if (answer === 'partial') return maxPoints / 2;
  return 0;
}

/** % de madurez de un tema (columna O). Rango 0-120 (10+20+20+20+20+30). */
export function dimensionScore(dim: MaturityDimensionDef, answers: (Answer | null)[]): number {
  return dim.levels.reduce((sum, level, i) => sum + scoreForAnswer(answers[i], level.maxPoints), 0);
}

/** Nivel de madurez a partir del %. Mismos umbrales que la columna P. */
export function levelForScore(scorePercent: number): MaturityLevel {
  if (scorePercent < 11) return 'execution';
  if (scorePercent < 31) return 'standard';
  if (scorePercent < 51) return 'control';
  if (scorePercent < 81) return 'optimization';
  if (scorePercent < 101) return 'excellence';
  return 'influencer';
}

export interface DimensionResult {
  id: DimensionId;
  tema: string;
  score: number; // 0-120
  level: MaturityLevel;
  superados: MaturityLevel[]; // niveles con respuesta "Sí" (columna Q) — traducir con common.maturityLevel
  enProgreso: { levelKey: MaturityLevel; description: string; deliverable: string }[]; // "Parcialmente" (columna R), con el texto REAL del tema (las claves de nivel se repiten entre temas)
  pendientes: MaturityLevel[]; // "No" (columna S)
  // Próximo paso recomendado: el primer nivel (en orden Ejecución->Influencer)
  // que NO quedó en "Sí". null si el tema ya está al máximo (los 6 niveles en "Sí").
  nextStep: { levelKey: MaturityLevel; description: string; deliverable: string } | null;
}

export interface AssessmentResult {
  dimensions: DimensionResult[];
  overallScore: number; // promedio de los 11 temas (0-120)
  overallLevel: MaturityLevel;
  levelProgress: { key: MaturityLevel; percent: number }[]; // "% Avance por nivel" (fila 6)
}

export function computeResults(dimensions: MaturityDimensionDef[], answers: DimensionAnswers): AssessmentResult {
  const results: DimensionResult[] = dimensions.map((dim) => {
    const dimAnswers = answers[dim.id];
    const score = dimensionScore(dim, dimAnswers);
    const superados: MaturityLevel[] = [];
    const enProgreso: { levelKey: MaturityLevel; description: string; deliverable: string }[] = [];
    const pendientes: MaturityLevel[] = [];
    let nextStep: DimensionResult['nextStep'] = null;

    dim.levels.forEach((level, i) => {
      const a = dimAnswers[i];
      if (a === 'yes') {
        superados.push(level.key);
      } else {
        if (a === 'partial') {
          enProgreso.push({ levelKey: level.key, description: level.description, deliverable: level.deliverable });
        } else {
          pendientes.push(level.key);
        }
        if (!nextStep) {
          nextStep = { levelKey: level.key, description: level.description, deliverable: level.deliverable };
        }
      }
    });

    return { id: dim.id, tema: dim.tema, score, level: levelForScore(score), superados, enProgreso, pendientes, nextStep };
  });

  const overallScore = results.reduce((sum, d) => sum + d.score, 0) / results.length;

  const levelDefs = dimensions[0].levels; // maxPoints/key son iguales en las 11 dimensiones, por índice
  const levelProgress = levelDefs.map((levelDef, levelIdx) => {
    const earned = dimensions.reduce(
      (sum, dim) => sum + scoreForAnswer(answers[dim.id][levelIdx], levelDef.maxPoints),
      0
    );
    const maxPossible = dimensions.length * levelDef.maxPoints;
    return { key: levelDef.key, percent: (earned / maxPossible) * 100 };
  });

  return { dimensions: results, overallScore, overallLevel: levelForScore(overallScore), levelProgress };
}

/** Arma el objeto `dimensions` de AssessmentDoc (forma fija de 11 llaves). */
export function buildDimensionsDoc(results: DimensionResult[]): AssessmentDoc['dimensions'] {
  const byId = Object.fromEntries(
    results.map((r) => [r.id, { score: r.score, level: r.level } satisfies DimensionScore])
  ) as Record<DimensionId, DimensionScore>;

  return {
    strategic: byId.strategic,
    finance: byId.finance,
    hr: byId.hr,
    sales: byId.sales,
    operations: byId.operations,
    esg: byId.esg,
    compliance: byId.compliance,
    knowledge: byId.knowledge,
    alliances: byId.alliances,
    customerService: byId.customerService,
    culture: byId.culture,
  };
}

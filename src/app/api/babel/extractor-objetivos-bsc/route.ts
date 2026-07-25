import { NextRequest, NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// Ruta NUEVA e independiente. NO modifica src/app/api/babel/route.ts,
// src/app/api/babel/indicadores/route.ts, src/app/api/babel/indicadores/priorizacion/route.ts,
// src/app/api/babel/extractor-entornos/route.ts ni src/app/api/babel/extractor-capacidades/route.ts
// (esas rutas ya estan probadas en produccion y no se tocan). Esta ruta reutiliza
// los MISMOS nombres de variables de entorno que las otras rutas de Babel para
// que funcione sin necesidad de configurar nada nuevo en Vercel:
//   FALLBACK_ENDPOINT / FALLBACK_MODEL / FALLBACK_API_KEY   -> Groq (1er intento)
//   TERTIARY_ENDPOINT / TERTIARY_MODEL / TERTIARY_API_KEY   -> OpenRouter (2do intento)
//   GEMINI_MODEL / GEMINI_API_KEY                            -> Gemini (3er intento, solo si hay llave)
//   ROUTER_ENDPOINT / ROUTER_MODEL / ROUTER_API_KEY          -> 9Router opcional (solo si esta configurado)
//
// Esta ruta NO lee nada de la Fase 5 directamente (esa conversacion no se
// toca). El usuario pega el resumen de su Fase 5 en Plan de Accion, y esta
// ruta convierte ese texto libre en Objetivos de negocio (Balanced Scorecard)
// para las perspectivas de Clientes, Procesos Internos y Aprendizaje/Crecimiento
// UNICAMENTE. La perspectiva Financiera se deja fuera a proposito: esa se
// captura en el flujo separado de Objetivos Financieros (Fase 4.5), para no
// duplicar ni contradecir esa otra herramienta.
// ---------------------------------------------------------------------------

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/' + GEMINI_MODEL + ':generateContent';

const FALLBACK_ENDPOINT = process.env.FALLBACK_ENDPOINT || 'https://api.groq.com/openai/v1/chat/completions';
const FALLBACK_MODEL = process.env.FALLBACK_MODEL || 'llama-3.3-70b-versatile';

const TERTIARY_ENDPOINT = process.env.TERTIARY_ENDPOINT || 'https://openrouter.ai/api/v1/chat/completions';
const TERTIARY_MODEL = process.env.TERTIARY_MODEL || 'openai/gpt-oss-20b:free';

const ROUTER_ENDPOINT = process.env.ROUTER_ENDPOINT || '';
const ROUTER_MODEL = process.env.ROUTER_MODEL || 'oc/qwen3-coder-plus';

interface Diagnostic {
  provider: string;
  status: string;
  error?: string;
}

interface ExtractorObjetivosBSCRequestBody {
  language?: 'es' | 'en';
  resumenFase5?: string;
}

function buildSystemPrompt(language: 'es' | 'en'): string {
  if (language === 'en') {
    return (
      'You are Babel, a strategic business architect. The user gives you the summary of Phase 5 of their strategic diagnostic, which ' +
      'includes a "Balanced Scorecard + OKRs" section defining quarterly Objectives for the 4 Balanced Scorecard perspectives ' +
      '(Financial, Customer, Internal Processes, Learning & Growth), plus other unrelated sections (Stakeholder Impact Matrix, ' +
      'Dynamic Cross-SWOT, Agile Execution Framework, Elevator Pitch) that you must IGNORE for this task.\n\n' +
      'Your task: read ONLY the "Balanced Scorecard + OKRs" section and extract CONCRETE (not generic) business Objectives for ' +
      'EXACTLY these 3 perspectives: Customer, Internal Processes, and Learning & Growth. Do NOT extract Financial-perspective ' +
      'objectives - those are handled separately.\n\n' +
      'Respond with ONLY a raw JSON array (no markdown fences, no prose before or after), between 3 and 9 items, where each item ' +
      'has EXACTLY this shape:\n' +
      '{"perspectiva":"clientes or procesos_internos or aprendizaje_crecimiento","texto":"one concrete, actionable objective sentence, max 200 characters"}'
    );
  }
  return (
    'Eres Babel, un arquitecto estrategico de negocios. El usuario te da el resumen de la Fase 5 de su diagnostico estrategico, que ' +
    'incluye una seccion de "Balanced Scorecard + OKRs" con Objetivos trimestrales para las 4 perspectivas del Balanced Scorecard ' +
    '(Finanzas, Clientes, Procesos Internos, Aprendizaje/Crecimiento), ademas de otras secciones no relacionadas (Matriz de Impacto ' +
    'en Stakeholders, FODA Cruzado Dinamico, Marco Agil de Ejecucion, Elevator Pitch) que debes IGNORAR para esta tarea.\n\n' +
    'Tu tarea: lee UNICAMENTE la seccion "Balanced Scorecard + OKRs" y extrae Objetivos de negocio CONCRETOS (no genericos) para ' +
    'EXACTAMENTE estas 3 perspectivas: Clientes, Procesos Internos y Aprendizaje/Crecimiento. NO extraigas objetivos de la ' +
    'perspectiva Financiera - esos se manejan por separado.\n\n' +
    'Responde UNICAMENTE con un arreglo JSON puro (sin marcadores de markdown, sin texto antes ni despues), entre 3 y 9 elementos, ' +
    'donde cada elemento tenga EXACTAMENTE esta forma:\n' +
    '{"perspectiva":"clientes o procesos_internos o aprendizaje_crecimiento","texto":"una frase de objetivo concreta y accionable, maximo 200 caracteres"}'
  );
}

function extractJsonArray(text: string): unknown {
  let cleaned = text.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) cleaned = fenceMatch[1].trim();
  const firstBracket = cleaned.indexOf('[');
  const lastBracket = cleaned.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    cleaned = cleaned.slice(firstBracket, lastBracket + 1);
  }
  return JSON.parse(cleaned);
}

async function tryGemini(systemPrompt: string, userMessage: string, diagnostics: Diagnostic[]): Promise<unknown[] | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(GEMINI_ENDPOINT + '?key=' + apiKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userMessage }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      diagnostics.push({ provider: 'gemini', status: 'error', error: JSON.stringify(data).slice(0, 300) });
      return null;
    }
    const blockReason = data && data.promptFeedback && data.promptFeedback.blockReason;
    if (blockReason) {
      diagnostics.push({ provider: 'gemini', status: 'blocked', error: blockReason });
      return null;
    }
    const text = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text;
    if (!text) {
      diagnostics.push({ provider: 'gemini', status: 'empty_response' });
      return null;
    }
    const parsed = extractJsonArray(text);
    if (!Array.isArray(parsed)) {
      diagnostics.push({ provider: 'gemini', status: 'not_array' });
      return null;
    }
    diagnostics.push({ provider: 'gemini', status: 'ok' });
    return parsed;
  } catch (err) {
    diagnostics.push({ provider: 'gemini', status: 'exception', error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

async function tryOpenAICompatible(
  systemPrompt: string,
  userMessage: string,
  endpoint: string,
  model: string,
  apiKey: string | undefined,
  label: string,
  diagnostics: Diagnostic[],
): Promise<unknown[] | null> {
  if (!apiKey) return null;
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.3,
        max_tokens: 4096,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      diagnostics.push({ provider: label, status: 'error', error: JSON.stringify(data).slice(0, 300) });
      return null;
    }
    const text = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!text) {
      diagnostics.push({ provider: label, status: 'empty_response' });
      return null;
    }
    const parsed = extractJsonArray(text);
    if (!Array.isArray(parsed)) {
      diagnostics.push({ provider: label, status: 'not_array' });
      return null;
    }
    diagnostics.push({ provider: label, status: 'ok' });
    return parsed;
  } catch (err) {
    diagnostics.push({ provider: label, status: 'exception', error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    route: '/api/babel/extractor-objetivos-bsc',
    note: 'Extractor de Objetivos BSC (Clientes, Procesos Internos, Aprendizaje/Crecimiento) a partir del resumen pegado de la Fase 5',
  });
}

export async function POST(req: NextRequest) {
  let body: ExtractorObjetivosBSCRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la solicitud invalido.' }, { status: 400 });
  }

  const language = body.language === 'en' ? 'en' : 'es';
  const resumenFase5 = typeof body.resumenFase5 === 'string' ? body.resumenFase5.trim() : '';

  if (!resumenFase5) {
    return NextResponse.json(
      { error: language === 'en' ? 'No Phase 5 summary was provided.' : 'No se recibio el resumen de la Fase 5.' },
      { status: 400 },
    );
  }

  const systemPrompt = buildSystemPrompt(language);
  const resumenRecortado = resumenFase5.slice(0, 12000);
  const userMessage = (language === 'en' ? 'Phase 5 summary:\n\n' : 'Resumen de la Fase 5:\n\n') + resumenRecortado;

  const diagnostics: Diagnostic[] = [];

  let result: unknown[] | null = await tryOpenAICompatible(
    systemPrompt,
    userMessage,
    FALLBACK_ENDPOINT,
    FALLBACK_MODEL,
    process.env.FALLBACK_API_KEY,
    'groq',
    diagnostics,
  );

  if (!result) {
    result = await tryOpenAICompatible(
      systemPrompt,
      userMessage,
      TERTIARY_ENDPOINT,
      TERTIARY_MODEL,
      process.env.TERTIARY_API_KEY,
      'openrouter',
      diagnostics,
    );
  }

  if (!result) {
    result = await tryGemini(systemPrompt, userMessage, diagnostics);
  }

  if (!result && ROUTER_ENDPOINT) {
    result = await tryOpenAICompatible(
      systemPrompt,
      userMessage,
      ROUTER_ENDPOINT.replace(/\/$/, '') + '/chat/completions',
      ROUTER_MODEL,
      process.env.ROUTER_API_KEY || 'no-key-needed',
      '9router',
      diagnostics,
    );
  }

  if (!result) {
    return NextResponse.json(
      {
        error:
          language === 'en'
            ? 'None of the configured AI providers could generate the proposal.'
            : 'Ninguno de los proveedores de IA configurados pudo generar la propuesta.',
        diagnostics: diagnostics,
        tip:
          language === 'en'
            ? 'Check that FALLBACK_API_KEY (Groq), TERTIARY_API_KEY (OpenRouter) or GEMINI_API_KEY are set in Vercel.'
            : 'Verifica que FALLBACK_API_KEY (Groq), TERTIARY_API_KEY (OpenRouter) o GEMINI_API_KEY esten configuradas en Vercel.',
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ sugerencias: result.slice(0, 9) });
}

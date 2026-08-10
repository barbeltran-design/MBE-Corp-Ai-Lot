import { NextRequest, NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// Ruta NUEVA e independiente. NO modifica src/app/api/babel/route.ts,
// src/app/api/babel/indicadores/route.ts, src/app/api/babel/indicadores/priorizacion/route.ts,
// src/app/api/babel/extractor-entornos/route.ts, src/app/api/babel/extractor-capacidades/route.ts
// ni src/app/api/babel/extractor-objetivos-bsc/route.ts (esas rutas ya estan
// probadas en produccion y no se tocan). Esta ruta reutiliza los MISMOS nombres
// de variables de entorno que las otras rutas de Babel para que funcione sin
// necesidad de configurar nada nuevo en Vercel:
//   FALLBACK_ENDPOINT / FALLBACK_MODEL / FALLBACK_API_KEY   -> Groq (2do intento)
//   TERTIARY_ENDPOINT / TERTIARY_MODEL / TERTIARY_API_KEY   -> OpenRouter (3er intento)
//   GEMINI_MODEL / GEMINI_API_KEY                            -> Gemini (1er intento, paga)
//   DEEPSEEK_ENDPOINT / DEEPSEEK_MODEL / DEEPSEEK_API_KEY        -> DeepSeek (4to intento, paga)
//
// Esta ruta NO lee nada de la Fase 1 directamente (esa conversacion no se
// toca). El usuario pega el resumen de su Fase 1 en Plan de Accion, y esta
// ruta convierte ese texto libre en una lista de Convocatorias y Fondos
// (punto 5 de la Fase 1: "Vinculacion con los ODS y Fondos"), etiquetadas
// como internacionales o nacionales/locales. Los ODS mencionados en ese mismo
// punto quedan solo como contexto de lectura para el modelo; no se modelan
// como registros propios porque el nombre de esta tarea (Extractor de
// Convocatorias y Fondos) apunta al listado de fondos/convocatorias, no a los
// ODS en si.
// ---------------------------------------------------------------------------

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/' + GEMINI_MODEL + ':generateContent';

const FALLBACK_ENDPOINT = process.env.FALLBACK_ENDPOINT || 'https://api.groq.com/openai/v1/chat/completions';
const FALLBACK_MODEL = process.env.FALLBACK_MODEL || 'llama-3.3-70b-versatile';

const TERTIARY_ENDPOINT = process.env.TERTIARY_ENDPOINT || 'https://openrouter.ai/api/v1/chat/completions';
const TERTIARY_MODEL = process.env.TERTIARY_MODEL || 'openai/gpt-oss-20b:free';

const DEEPSEEK_ENDPOINT = process.env.DEEPSEEK_ENDPOINT || 'https://api.deepseek.com/chat/completions';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

interface Diagnostic {
  provider: string;
  status: string;
  error?: string;
}

interface ExtractorConvocatoriasRequestBody {
  language?: 'es' | 'en';
  resumenFase1?: string;
}

function buildSystemPrompt(language: 'es' | 'en'): string {
  if (language === 'en') {
    return (
      'You are Babel, a strategic business architect. The user gives you the summary of Phase 1 of their strategic diagnostic, which ' +
      'includes a "SDG and Funding Alignment" section (point 5) listing 2-3 connected UN Sustainable Development Goals plus 5 ' +
      'international and 3 national/local funds or calls for proposals, alongside other unrelated sections (360 Value Proposition, ' +
      'Extended Business Model, Golden Circle, Precision Segmentation) that you must IGNORE for this task.\n\n' +
      'Your task: read ONLY the "SDG and Funding Alignment" section and extract the funds/programs/calls for proposals mentioned ' +
      'there (ignore the SDG names themselves - only extract the funding opportunities). For each one, classify it as ' +
      '"internacional" if it is a global or multi-country fund/program, or "nacional" if it is specific to the user\'s own country ' +
      'or a local/regional program.\n\n' +
      'Respond with ONLY a raw JSON array (no markdown fences, no prose before or after), between 3 and 10 items, where each item ' +
      'has EXACTLY this shape:\n' +
      '{"tipo":"internacional or nacional","nombre":"fund or program name, max 120 characters","requisito":"the key requirement or focus, max 200 characters"}'
    );
  }
  return (
    'Eres Babel, un arquitecto estrategico de negocios. El usuario te da el resumen de la Fase 1 de su diagnostico estrategico, que ' +
    'incluye una seccion "Vinculacion con los ODS y Fondos" (punto 5) con 2-3 Objetivos de Desarrollo Sostenible conectados, ademas ' +
    'de 5 convocatorias o fondos internacionales y 3 nacionales/locales, junto con otras secciones no relacionadas (Propuesta de ' +
    'Valor 360, Modelo de Negocio Extendido, Circulo Dorado, Segmentacion de Precision) que debes IGNORAR para esta tarea.\n\n' +
    'Tu tarea: lee UNICAMENTE la seccion "Vinculacion con los ODS y Fondos" y extrae los fondos/programas/convocatorias mencionados ' +
    'ahi (ignora los nombres de los ODS en si - extrae solo las oportunidades de financiamiento). Para cada uno, clasificalo como ' +
    '"internacional" si es un fondo o programa global o multi-pais, o "nacional" si es especifico del pais del usuario o un ' +
    'programa local/regional.\n\n' +
    'Responde UNICAMENTE con un arreglo JSON puro (sin marcadores de markdown, sin texto antes ni despues), entre 3 y 10 elementos, ' +
    'donde cada elemento tenga EXACTAMENTE esta forma:\n' +
    '{"tipo":"internacional o nacional","nombre":"nombre del fondo o programa, maximo 120 caracteres","requisito":"el requisito o enfoque clave, maximo 200 caracteres"}'
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
    route: '/api/babel/extractor-convocatorias',
    note: 'Extractor de Convocatorias y Fondos (internacionales y nacionales/locales) a partir del resumen pegado de la Fase 1, punto 5 (ODS y Fondos)',
  });
}

export async function POST(req: NextRequest) {
  let body: ExtractorConvocatoriasRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la solicitud invalido.' }, { status: 400 });
  }

  const language = body.language === 'en' ? 'en' : 'es';
  const resumenFase1 = typeof body.resumenFase1 === 'string' ? body.resumenFase1.trim() : '';

  if (!resumenFase1) {
    return NextResponse.json(
      { error: language === 'en' ? 'No Phase 1 summary was provided.' : 'No se recibio el resumen de la Fase 1.' },
      { status: 400 },
    );
  }

  const systemPrompt = buildSystemPrompt(language);
  const resumenRecortado = resumenFase1.slice(0, 12000);
  const userMessage = (language === 'en' ? 'Phase 1 summary:\n\n' : 'Resumen de la Fase 1:\n\n') + resumenRecortado;

  const diagnostics: Diagnostic[] = [];

  let result: unknown[] | null = await tryGemini(systemPrompt, userMessage, diagnostics);

  if (!result) {
    result = await tryOpenAICompatible(
      systemPrompt,
      userMessage,
      FALLBACK_ENDPOINT,
      FALLBACK_MODEL,
      process.env.FALLBACK_API_KEY,
      'groq',
      diagnostics,
    );
  }

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
    result = await tryOpenAICompatible(
      systemPrompt,
      userMessage,
      DEEPSEEK_ENDPOINT,
      DEEPSEEK_MODEL,
      process.env.DEEPSEEK_API_KEY,
      'deepseek',
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
            ? 'Check that GEMINI_API_KEY, FALLBACK_API_KEY (Groq), TERTIARY_API_KEY (OpenRouter) or DEEPSEEK_API_KEY are set in Vercel.'
            : 'Verifica que GEMINI_API_KEY, FALLBACK_API_KEY (Groq), TERTIARY_API_KEY (OpenRouter) o DEEPSEEK_API_KEY esten configuradas en Vercel.',
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ sugerencias: result.slice(0, 10) });
}

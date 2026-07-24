import { NextRequest, NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// Ruta NUEVA e independiente. NO modifica src/app/api/babel/route.ts,
// src/app/api/babel/indicadores/route.ts ni
// src/app/api/babel/indicadores/priorizacion/route.ts (esas rutas ya estan
// probadas en produccion y no se tocan). Esta ruta reutiliza los MISMOS
// nombres de variables de entorno que las otras rutas de Babel para que
// funcione sin necesidad de configurar nada nuevo en Vercel:
//   FALLBACK_ENDPOINT / FALLBACK_MODEL / FALLBACK_API_KEY   -> Groq (1er intento)
//   TERTIARY_ENDPOINT / TERTIARY_MODEL / TERTIARY_API_KEY   -> OpenRouter (2do intento)
//   GEMINI_MODEL / GEMINI_API_KEY                            -> Gemini (3er intento, solo si hay llave)
//   ROUTER_ENDPOINT / ROUTER_MODEL / ROUTER_API_KEY          -> 9Router opcional (solo si esta configurado)
//
// Esta ruta NO lee nada de la Fase 2 directamente (esa conversacion no se
// toca). El usuario pega el resumen de su Fase 2 en Plan de Accion, y esta
// ruta convierte ese texto libre en Amenazas/Oportunidades concretas,
// tomando en cuenta tambien aspectos de Responsabilidad Socio Ambiental
// (ESG) como una lente adicional de lectura sobre el mismo texto pegado.
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

interface ObjetivoParaIA {
  id: string;
  perspectiva: string;
  texto: string;
}

interface ExtractorEntornosRequestBody {
  language?: 'es' | 'en';
  resumenFase2?: string;
  objetivos?: ObjetivoParaIA[];
}

function buildSystemPrompt(language: 'es' | 'en'): string {
  if (language === 'en') {
    return (
      'You are Babel, a strategic business architect. The user gives you (1) the summary of Phase 2 of their strategic diagnostic ' +
      '- which includes a PESTEL analysis (Political, Economic, Social, Technological, Ecological and Legal factors), a Market Forces ' +
      'analysis, Sector Trends, and a 5-Year Strategic Outlook - and (2) the list of the business current Strategic Objectives, each ' +
      'with a unique id, its Balanced Scorecard perspective, and its text.\n\n' +
      'Your task: read the summary and extract CONCRETE (not generic) Threats and Opportunities for the business. Also consider, ' +
      'within that same summary, Environmental, Social and Governance (ESG) aspects that could represent a threat (e.g. legal or ' +
      'reputational risk) or an opportunity (e.g. certifications, cost savings, new sustainable markets).\n\n' +
      'For each Threat or Opportunity you identify, indicate which of the given Strategic Objectives it relates to most directly ' +
      '(use the EXACT given id, never invent a new one; if it truly does not relate to any of them, use the id of the first one in the list).\n\n' +
      'Respond with ONLY a raw JSON array (no markdown fences, no prose before or after), between 3 and 10 items, where each item ' +
      'has EXACTLY this shape:\n' +
      '{"objetivoId":"one of the given ids","tipo":"amenaza or oportunidad","descripcion":"one concrete, actionable sentence, max 200 characters"}'
    );
  }
  return (
    'Eres Babel, un arquitecto estrategico de negocios. El usuario te da (1) el resumen de la Fase 2 de su diagnostico estrategico ' +
    '- que incluye un analisis PESTEL (factores Politicos, Economicos, Sociales, Tecnologicos, Ecologicos y Legales), un analisis de ' +
    'Fuerzas del Mercado, Tendencias Sectoriales y una Prospectiva Estrategica a 5 anos - y (2) la lista de Objetivos Estrategicos ' +
    'actuales del negocio, cada uno con un id unico, su perspectiva (Balanced Scorecard) y su texto.\n\n' +
    'Tu tarea: lee el resumen y extrae Amenazas y Oportunidades CONCRETAS (no genericas) para el negocio. Considera tambien, dentro ' +
    'del mismo resumen, aspectos de Responsabilidad Social y Ambiental (ESG) que puedan representar una amenaza (por ejemplo riesgos ' +
    'legales o reputacionales) o una oportunidad (por ejemplo certificaciones, ahorro de costos, nuevos mercados sostenibles).\n\n' +
    'Para cada Amenaza u Oportunidad que identifiques, indica a cual de los Objetivos Estrategicos dados se relaciona mas ' +
    'directamente (usa el id EXACTO dado, sin inventar ids nuevos; si de verdad no se relaciona con ninguno, usa el id del primero ' +
    'de la lista).\n\n' +
    'Responde UNICAMENTE con un arreglo JSON puro (sin marcadores de markdown, sin texto antes ni despues), entre 3 y 10 elementos, ' +
    'donde cada elemento tenga EXACTAMENTE esta forma:\n' +
    '{"objetivoId":"uno de los ids dados","tipo":"amenaza o oportunidad","descripcion":"una frase concreta y accionable, maximo 200 caracteres"}'
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
    route: '/api/babel/extractor-entornos',
    note: 'Extractor de Amenazas/Oportunidades (PESTEL + Fuerzas + Prospectiva + ESG) a partir del resumen pegado de la Fase 2',
  });
}

export async function POST(req: NextRequest) {
  let body: ExtractorEntornosRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la solicitud invalido.' }, { status: 400 });
  }

  const language = body.language === 'en' ? 'en' : 'es';
  const resumenFase2 = typeof body.resumenFase2 === 'string' ? body.resumenFase2.trim() : '';
  const objetivos = Array.isArray(body.objetivos) ? body.objetivos : [];

  if (!resumenFase2) {
    return NextResponse.json(
      { error: language === 'en' ? 'No Phase 2 summary was provided.' : 'No se recibio el resumen de la Fase 2.' },
      { status: 400 },
    );
  }

  if (objetivos.length === 0) {
    return NextResponse.json(
      {
        error:
          language === 'en'
            ? 'You need at least one Strategic Objective before suggesting Threats/Opportunities.'
            : 'Necesitas al menos un Objetivo Estrategico antes de sugerir Amenazas/Oportunidades.',
      },
      { status: 400 },
    );
  }

  const systemPrompt = buildSystemPrompt(language);
  const resumenRecortado = resumenFase2.slice(0, 12000);
  const objetivosJson = JSON.stringify(objetivos).slice(0, 4000);
  const userMessage =
    (language === 'en' ? 'Phase 2 summary:\n\n' : 'Resumen de la Fase 2:\n\n') +
    resumenRecortado +
    (language === 'en' ? '\n\nExisting Strategic Objectives (JSON array):\n\n' : '\n\nObjetivos Estrategicos existentes (arreglo JSON):\n\n') +
    objetivosJson;

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

  return NextResponse.json({ sugerencias: result.slice(0, 10) });
}

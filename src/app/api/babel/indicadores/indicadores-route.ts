import { NextRequest, NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// Ruta NUEVA e independiente. NO modifica src/app/api/babel/route.ts (esa
// ruta ya esta probada en produccion y no se toca). Esta ruta reutiliza los
// MISMOS nombres de variables de entorno que la ruta principal de Babel para
// que funcione sin necesidad de configurar nada nuevo en Vercel:
//   FALLBACK_ENDPOINT / FALLBACK_MODEL / FALLBACK_API_KEY   -> Groq (1er intento)
//   TERTIARY_ENDPOINT / TERTIARY_MODEL / TERTIARY_API_KEY   -> OpenRouter (2do intento)
//   GEMINI_MODEL / GEMINI_API_KEY                            -> Gemini (3er intento, solo si hay llave)
//   ROUTER_ENDPOINT / ROUTER_MODEL / ROUTER_API_KEY          -> 9Router opcional (solo si esta configurado)
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

interface IndicadoresRequestBody {
  language?: 'es' | 'en';
  planContext?: string;
  roleKeys?: string;
}

function buildSystemPrompt(language: 'es' | 'en', roleKeys: string): string {
  if (language === 'en') {
    return (
      'You are Babel, a strategic business architect. The user gave you the full context of their Strategic Action Plan below: ' +
      'business objectives (each tagged with a Balanced Scorecard perspective: financiera, clientes, procesos_internos or aprendizaje_crecimiento), ' +
      'their threats and opportunities, and the actions already assigned to each project with their owners.\n\n' +
      'Your task: propose between 6 and 12 SMART indicators (Specific, Measurable, Achievable, Relevant, Time-bound) that will let the business ' +
      'track progress on those objectives, aligned to the Balanced Scorecard perspectives, and linked whenever possible to the threats/opportunities ' +
      'and to the actions already defined.\n\n' +
      'Respond with ONLY a raw JSON array (no markdown fences, no prose before or after) where each item has EXACTLY this shape:\n' +
      '{"objetivoTexto":"copy the exact text of one objective from the list below","entornoTexto":"copy the exact text of a threat/opportunity of that objective, or empty string if none applies","accionesTexto":["copy the exact text of one or more related actions from the list, or empty array"],"nombre":"indicator name","formula":"calculation formula","especifico":"what exactly is measured and why","medible":"unit of measure","alcanzable":"why the target is realistic","relevante":"why it matters for this objective","temporal":"over what period it is evaluated","lineaBase":"current/starting value","meta":"target value","fechaLimiteSugerida":"YYYY-MM-DD","frecuencia":"one of: semanal, mensual, trimestral, semestral, anual","responsableRoleKey":"one of these exact keys: ' +
      roleKeys +
      '"}\n\nAlways copy objetivoTexto/entornoTexto/accionesTexto VERBATIM from the context provided — do not paraphrase them.'
    );
  }
  return (
    'Eres Babel, un arquitecto estrategico de negocios. El usuario te dio el contexto completo de su Plan de Accion Estrategico a continuacion: ' +
    'objetivos de negocio (cada uno etiquetado con una perspectiva de Balanced Scorecard: financiera, clientes, procesos_internos o aprendizaje_crecimiento), ' +
    'sus amenazas y oportunidades, y las acciones ya asignadas a cada proyecto con sus responsables.\n\n' +
    'Tu tarea: propone entre 6 y 12 indicadores SMART (Especifico, Medible, Alcanzable, Relevante, con plazo Temporal) que permitan a la empresa dar ' +
    'seguimiento a esos objetivos, alineados a las perspectivas del Balanced Scorecard, y vinculados siempre que sea posible a las amenazas/oportunidades ' +
    'y a las acciones ya definidas.\n\n' +
    'Responde UNICAMENTE con un arreglo JSON puro (sin marcadores de markdown, sin texto antes ni despues) donde cada elemento tenga EXACTAMENTE esta forma:\n' +
    '{"objetivoTexto":"copia el texto exacto de un objetivo de la lista de abajo","entornoTexto":"copia el texto exacto de una amenaza/oportunidad de ese objetivo, o cadena vacia si no aplica","accionesTexto":["copia el texto exacto de una o mas acciones relacionadas de la lista, o arreglo vacio"],"nombre":"nombre del indicador","formula":"formula de calculo","especifico":"que se mide exactamente y por que","medible":"unidad de medida","alcanzable":"por que la meta es realista","relevante":"por que importa para este objetivo","temporal":"en que plazo se evalua","lineaBase":"valor actual/de partida","meta":"valor objetivo","fechaLimiteSugerida":"YYYY-MM-DD","frecuencia":"una de: semanal, mensual, trimestral, semestral, anual","responsableRoleKey":"una de estas claves exactas: ' +
    roleKeys +
    '"}\n\nSiempre copia objetivoTexto/entornoTexto/accionesTexto TEXTUALMENTE del contexto proporcionado — no los parafrasees.'
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
        generationConfig: { temperature: 0.4, maxOutputTokens: 4096 },
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
        temperature: 0.4,
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
  return NextResponse.json({ status: 'ok', route: '/api/babel/indicadores', note: 'Propuesta de indicadores SMART + Balanced Scorecard' });
}

export async function POST(req: NextRequest) {
  let body: IndicadoresRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la solicitud invalido.' }, { status: 400 });
  }

  const language = body.language === 'en' ? 'en' : 'es';
  const planContext = (body.planContext || '').slice(0, 6000);
  const roleKeys = body.roleKeys || '';

  if (!planContext.trim()) {
    return NextResponse.json(
      { error: language === 'en' ? 'No action plan data was provided.' : 'No se recibio informacion del plan de accion.' },
      { status: 400 },
    );
  }

  const systemPrompt = buildSystemPrompt(language, roleKeys);
  const userMessage =
    (language === 'en' ? 'Action plan context:\n\n' : 'Contexto del plan de accion:\n\n') + planContext;

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

  return NextResponse.json({ indicadores: result.slice(0, 14) });
}

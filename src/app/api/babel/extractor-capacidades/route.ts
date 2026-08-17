import { NextRequest, NextResponse } from 'next/server';
import { intentarRecargaIA, generarPedidoId } from '@/lib/ia-recarga';

// ---------------------------------------------------------------------------
// Ruta NUEVA e independiente. NO modifica src/app/api/babel/route.ts,
// src/app/api/babel/indicadores/route.ts, src/app/api/babel/indicadores/priorizacion/route.ts
// ni src/app/api/babel/extractor-entornos/route.ts (esas rutas ya estan
// probadas en produccion y no se tocan). Esta ruta reutiliza los MISMOS
// nombres de variables de entorno que las otras rutas de Babel para que
// funcione sin necesidad de configurar nada nuevo en Vercel:
//   FALLBACK_ENDPOINT / FALLBACK_MODEL / FALLBACK_API_KEY   -> Groq (2do intento)
//   TERTIARY_ENDPOINT / TERTIARY_MODEL / TERTIARY_API_KEY   -> OpenRouter (3er intento)
//   GEMINI_MODEL / GEMINI_API_KEY                            -> Gemini (1er intento, paga)
//   DEEPSEEK_ENDPOINT / DEEPSEEK_MODEL / DEEPSEEK_API_KEY        -> DeepSeek (4to intento, paga)
//
// Esta ruta NO lee nada de la Fase 3 directamente (esa conversacion no se
// toca). El usuario pega el resumen de su Fase 3 en Plan de Accion, y esta
// ruta convierte ese texto libre en Capacidades (basicas y diferenciadoras)
// concretas, cada una vinculada a una Amenaza/Oportunidad YA EXISTENTE en el
// tablero (el id exacto se toma de la lista que el cliente envia). Las
// Capacidades siempre se crean como Fortaleza: la Fase 3 solo describe
// capacidades que el negocio SI tiene, nunca describe debilidades.
// ---------------------------------------------------------------------------

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/' + GEMINI_MODEL + ':generateContent';

const FALLBACK_ENDPOINT = process.env.FALLBACK_ENDPOINT || 'https://api.groq.com/openai/v1/chat/completions';
const FALLBACK_MODEL = process.env.FALLBACK_MODEL || 'openai/gpt-oss-120b';

const TERTIARY_ENDPOINT = process.env.TERTIARY_ENDPOINT || 'https://openrouter.ai/api/v1/chat/completions';
const TERTIARY_MODEL = process.env.TERTIARY_MODEL || 'openai/gpt-oss-20b:free';

const DEEPSEEK_ENDPOINT = process.env.DEEPSEEK_ENDPOINT || 'https://api.deepseek.com/chat/completions';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

interface Diagnostic {
  provider: string;
  status: string;
  error?: string;
}

interface EntornoParaIA {
  id: string;
  tipo: string;
  descripcion: string;
}

interface ExtractorCapacidadesRequestBody {
  language?: 'es' | 'en';
  resumenFase3?: string;
  entornos?: EntornoParaIA[];
}

function buildSystemPrompt(language: 'es' | 'en'): string {
  if (language === 'en') {
    return (
      'You are Babel, a strategic business architect. The user gives you (1) the summary of Phase 3 of their strategic diagnostic, ' +
      'which includes the "Key Capabilities" section - distinguishing basic capabilities (indispensable to operate, non-differentiating) ' +
      'from differentiating capabilities (what makes the business unique versus competitors) - together with an Operations/Cost-Flow ' +
      'plan and a Commercial Strategy/Customer Experience section, and (2) the list of the business current Threats and Opportunities, ' +
      'each with a unique id, its type (threat or opportunity), and its text.\n\n' +
      'Your task: read the summary and extract CONCRETE (not generic) Capabilities from the "Key Capabilities" section only. Prioritize ' +
      'differentiating capabilities, but you may also include a few important basic capabilities if they are clearly stated. For each ' +
      'capability, start the sentence with "Differentiating capability:" or "Basic capability:" so the type stays clear in the text.\n\n' +
      'For each Capability you identify, indicate which of the given Threats/Opportunities it most directly helps address or take ' +
      'advantage of (use the EXACT given id, never invent a new one; if it truly does not relate to any of them, use the id of the ' +
      'first one in the list).\n\n' +
      'Respond with ONLY a raw JSON array (no markdown fences, no prose before or after), between 3 and 10 items, where each item ' +
      'has EXACTLY this shape:\n' +
      '{"entornoId":"one of the given ids","descripcion":"one concrete sentence starting with Differentiating capability: or Basic capability:, max 200 characters"}'
    );
  }
  return (
    'Eres Babel, un arquitecto estrategico de negocios. El usuario te da (1) el resumen de la Fase 3 de su diagnostico estrategico, ' +
    'que incluye la seccion de "Capacidades Clave" - distinguiendo capacidades basicas (indispensables para operar, no diferencian) de ' +
    'capacidades diferenciadoras (las que hacen unico al negocio frente a la competencia) - junto con un Plan Operativo Flujo-Costo y una ' +
    'seccion de Estrategia Comercial/Experiencia de Cliente, y (2) la lista de Amenazas y Oportunidades actuales del negocio, cada una ' +
    'con un id unico, su tipo (amenaza u oportunidad) y su texto.\n\n' +
    'Tu tarea: lee el resumen y extrae Capacidades CONCRETAS (no genericas) unicamente de la seccion "Capacidades Clave". Prioriza las ' +
    'capacidades diferenciadoras, pero puedes incluir tambien alguna capacidad basica importante si esta claramente mencionada. Para ' +
    'cada capacidad, inicia la frase con "Capacidad diferenciadora:" o "Capacidad basica:" para que el tipo quede claro en el texto.\n\n' +
    'Para cada Capacidad que identifiques, indica a cual de las Amenazas/Oportunidades dadas ayuda mas directamente a enfrentar o ' +
    'aprovechar (usa el id EXACTO dado, sin inventar ids nuevos; si de verdad no se relaciona con ninguna, usa el id de la primera de ' +
    'la lista).\n\n' +
    'Responde UNICAMENTE con un arreglo JSON puro (sin marcadores de markdown, sin texto antes ni despues), entre 3 y 10 elementos, ' +
    'donde cada elemento tenga EXACTAMENTE esta forma:\n' +
    '{"entornoId":"uno de los ids dados","descripcion":"una frase concreta que inicie con Capacidad diferenciadora: o Capacidad basica:, maximo 200 caracteres"}'
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

async function tryGemini(systemPrompt: string, userMessage: string, diagnostics: Diagnostic[], reintento = false, pedidoId?: string): Promise<unknown[] | null> {
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
  if (!res.ok && (res.status === 429 || res.status === 402) && !reintento) {
    const rec = await intentarRecargaIA('gemini', pedidoId || generarPedidoId());
    if (rec.recargada) return tryGemini(systemPrompt, userMessage, diagnostics, true, pedidoId);
  }
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
  reintento = false,
  pedidoId?: string,
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
        max_tokens: 8192,
      }),
    });
    const data = await res.json();
  if (!res.ok && (res.status === 429 || res.status === 402) && !reintento) {
    const rec = await intentarRecargaIA('gemini', pedidoId || generarPedidoId());
    if (rec.recargada) return tryGemini(systemPrompt, userMessage, diagnostics, true, pedidoId);
  }
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
    route: '/api/babel/extractor-capacidades',
    note: 'Extractor de Capacidades (basicas y diferenciadoras) a partir del resumen pegado de la Fase 3',
  });
}

export async function POST(req: NextRequest) {
  let body: ExtractorCapacidadesRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la solicitud invalido.' }, { status: 400 });
  }

  const language = body.language === 'en' ? 'en' : 'es';
  const resumenFase3 = typeof body.resumenFase3 === 'string' ? body.resumenFase3.trim() : '';
  const entornos = Array.isArray(body.entornos) ? body.entornos : [];

  if (!resumenFase3) {
    return NextResponse.json(
      { error: language === 'en' ? 'No Phase 3 summary was provided.' : 'No se recibio el resumen de la Fase 3.' },
      { status: 400 },
    );
  }

  if (entornos.length === 0) {
    return NextResponse.json(
      {
        error:
          language === 'en'
            ? 'You need at least one Threat/Opportunity before suggesting Capabilities.'
            : 'Necesitas al menos una Amenaza/Oportunidad antes de sugerir Capacidades.',
      },
      { status: 400 },
    );
  }

  const systemPrompt = buildSystemPrompt(language);
  const resumenRecortado = resumenFase3.slice(0, 12000);
  const entornosJson = JSON.stringify(entornos).slice(0, 4000);
  const userMessage =
    (language === 'en' ? 'Phase 3 summary:\n\n' : 'Resumen de la Fase 3:\n\n') +
    resumenRecortado +
    (language === 'en' ? '\n\nExisting Threats/Opportunities (JSON array):\n\n' : '\n\nAmenazas/Oportunidades existentes (arreglo JSON):\n\n') +
    entornosJson;

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

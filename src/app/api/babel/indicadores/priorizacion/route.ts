import { NextRequest, NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// Ruta NUEVA e independiente. NO modifica src/app/api/babel/route.ts ni
// src/app/api/babel/indicadores/route.ts (esas rutas ya estan probadas en
// produccion y no se tocan). Esta ruta reutiliza los MISMOS nombres de
// variables de entorno que las otras rutas de Babel para que funcione sin
// necesidad de configurar nada nuevo en Vercel:
//   FALLBACK_ENDPOINT / FALLBACK_MODEL / FALLBACK_API_KEY   -> Groq (2do intento)
//   TERTIARY_ENDPOINT / TERTIARY_MODEL / TERTIARY_API_KEY   -> OpenRouter (3er intento)
//   GEMINI_MODEL / GEMINI_API_KEY                            -> Gemini (1er intento, paga)
//   DEEPSEEK_ENDPOINT / DEEPSEEK_MODEL / DEEPSEEK_API_KEY        -> DeepSeek (4to intento, paga)
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

interface AccionParaIA {
  id: string;
  descripcion: string;
  entregable: string;
  contexto: string;
  responsableRoleKey?: string;
}

interface RoleParaIA {
  key: string;
  name: string;
  person: string;
}

interface PriorizacionRequestBody {
  language?: 'es' | 'en';
  acciones?: AccionParaIA[];
  roles?: RoleParaIA[];
}

function buildSystemPrompt(language: 'es' | 'en'): string {
  if (language === 'en') {
    return (
      'You are Babel, a strategic business architect. The user gives you a list of concrete actions from their Strategic Action Plan, ' +
      'each with a unique id, its description, its expected deliverable, and the business context it belongs to (objective, threat/opportunity, project).\n\n' +
      'Your task: for EVERY action in the list, evaluate its Feasibility (how viable it is to execute with the resources and capabilities typical of a ' +
      'micro or small business) and its expected economic Impact (how significant its effect on the business would be if executed well), and assign a ' +
      'Responsible: choose the role from the user\'s org chart whose function naturally includes executing that action.\n\n' +
      'Respond with ONLY a raw JSON array (no markdown fences, no prose before or after) where each item has EXACTLY this shape:\n' +
      '{"id":"copy the EXACT id of the action as given to you","factibilidad":"one of: alta, media, baja, nula","impacto":"one of: alto, medio, bajo, nulo","responsableRoleKey":"copy the EXACT key of the org chart role that fits best, or an empty string if none fits","justificacion":"one short sentence explaining why"}\n\n' +
      'You must return exactly one item per action received, reusing the same id, without inventing new ids and without skipping any action.'
    );
  }
  return (
    'Eres Babel, un arquitecto estrategico de negocios. El usuario te da una lista de acciones concretas de su Plan de Accion Estrategico, ' +
    'cada una con un id unico, su descripcion, su entregable esperado y el contexto de negocio al que pertenece (objetivo, amenaza/oportunidad, proyecto).\n\n' +
    'Tu tarea: para CADA accion de la lista, evalua su Factibilidad (que tan viable es ejecutarla con los recursos y capacidades tipicos de una micro o ' +
    'pequena empresa) y su Impacto economico esperado (que tan significativo seria su efecto en el negocio si se ejecuta bien), y asigna un Responsable: ' +
    'elige el rol del organigrama del usuario cuya funcion naturalmente incluye ejecutar esa accion.\n\n' +
    'Responde UNICAMENTE con un arreglo JSON puro (sin marcadores de markdown, sin texto antes ni despues) donde cada elemento tenga EXACTAMENTE esta forma:\n' +
    '{"id":"copia el id EXACTO de la accion tal como se te dio","factibilidad":"una de: alta, media, baja, nula","impacto":"uno de: alto, medio, bajo, nulo","responsableRoleKey":"copia la key EXACTA del rol del organigrama que mejor encaja, o cadena vacia si ninguno encaja","justificacion":"una frase breve explicando por que"}\n\n' +
    'Debes regresar exactamente un elemento por cada accion recibida, usando el mismo id, sin inventar ids nuevos y sin omitir ninguna accion.'
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
        max_tokens: 8192,
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
  return NextResponse.json({ status: 'ok', route: '/api/babel/priorizacion', note: 'Sugerencia de Factibilidad e Impacto por accion (IA)' });
}

export async function POST(req: NextRequest) {
  let body: PriorizacionRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la solicitud invalido.' }, { status: 400 });
  }

  const language = body.language === 'en' ? 'en' : 'es';
  const acciones = Array.isArray(body.acciones) ? body.acciones : [];
  const roles = Array.isArray(body.roles) ? body.roles : [];

  if (acciones.length === 0) {
    return NextResponse.json(
      { error: language === 'en' ? 'No actions were provided to evaluate.' : 'No se recibieron acciones para evaluar.' },
      { status: 400 },
    );
  }

  const systemPrompt = buildSystemPrompt(language);
  const accionesJson = JSON.stringify(acciones).slice(0, 14000);
  let userMessage =
    (language === 'en' ? 'Actions to evaluate (JSON array):\n\n' : 'Acciones a evaluar (arreglo JSON):\n\n') + accionesJson;
  if (roles.length > 0) {
    userMessage +=
      '\n\n' +
      (language === 'en'
        ? 'User org chart roles to assign a Responsible from (JSON array: key, name, assigned person):\n\n'
        : 'Roles del organigrama del usuario para asignar un Responsable (arreglo JSON: key, nombre, persona asignada):\n\n') +
      JSON.stringify(roles).slice(0, 4000);
  }

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

  return NextResponse.json({ sugerencias: result.slice(0, 300) });
}

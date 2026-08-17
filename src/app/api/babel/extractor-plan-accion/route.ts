import { NextRequest, NextResponse } from 'next/server';
import { BUENAS_PRACTICAS } from '@/lib/buenas-practicas';

// ---------------------------------------------------------------------------
// Ruta NUEVA para el Plan de Accion: reemplaza las cajas previas de
// extractor-entornos/capacidades/objetivos-bsc/convocatorias por 3 pasos
// secuenciales con contexto CHICO y dirigido:
//
//   paso 'entornos' : Detecta Amenazas y Oportunidades para cada objetivo
//                     (secciones 1.2, 1.4, 2.1, 2.2, 2.3 y 4.1 de la
//                     reflexion estrategica). Una amenaza/oportunidad puede
//                     impactar a VARIOS objetivos (respuesta con objetivoIds).
//   paso 'fds'      : Sugiere Fortalezas y Debilidades por Amenaza/
//                     Oportunidad (secciones 1.1, 1.3, 3.1, 3.2, 3.3 y 4.2)
//                     + debilidades de los niveles bajos de madurez. Una
//                     fortaleza/debilidad puede ligarse a VARIAS
//                     amenazas/oportunidades (respuesta con entornoIds).
//   paso 'acciones' : Sugiere Acciones para blindar Fortalezas y mejorar
//                     Debilidades (fases + siguientes pasos de madurez +
//                     catalogo estatico de Buenas Practicas con Tema,
//                     Buena Practica, Perspectiva BSC y Mentor).
//
// Reutiliza los MISMOS nombres de variables de entorno que las otras rutas
// de Babel (nada nuevo que configurar en Vercel):
//   FALLBACK_ENDPOINT / FALLBACK_MODEL / FALLBACK_API_KEY  -> Groq (2do intento)
//   TERTIARY_ENDPOINT / TERTIARY_MODEL / TERTIARY_API_KEY  -> OpenRouter (3ro)
//   GEMINI_MODEL / GEMINI_API_KEY                           -> Gemini (1ro, paga)
//   DEEPSEEK_ENDPOINT / DEEPSEEK_MODEL / DEEPSEEK_API_KEY        -> DeepSeek (4to intento, paga)
// ---------------------------------------------------------------------------

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/' + GEMINI_MODEL + ':generateContent';

const FALLBACK_ENDPOINT = process.env.FALLBACK_ENDPOINT || 'https://api.groq.com/openai/v1/chat/completions';
const FALLBACK_MODEL = process.env.FALLBACK_MODEL || 'openai/gpt-oss-120b';

const TERTIARY_ENDPOINT = process.env.TERTIARY_ENDPOINT || 'https://openrouter.ai/api/v1/chat/completions';
const TERTIARY_MODEL = process.env.TERTIARY_MODEL || 'openai/gpt-oss-20b:free';

const DEEPSEEK_ENDPOINT = process.env.DEEPSEEK_ENDPOINT || 'https://api.deepseek.com/chat/completions';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

type PlanLang = 'es' | 'en';
type PlanPaso = 'entornos' | 'fds' | 'acciones';

interface Diagnostic {
  provider: string;
  status: string;
  error?: string;
}

interface PlanAccionRequestBody {
  language?: PlanLang;
  paso?: string;
  objetivos?: { id: string; texto: string }[];
  entornos?: { id: string; tipo: string; descripcion: string }[];
  fds?: { id: string; tipo: string; descripcion: string }[];
  contextoFases?: string;
  madurezDebilidades?: string;
  madurezPendientes?: string;
}

function buildTablaPracticas(language: PlanLang): string {
  const header = language === 'en' ? 'Theme | Best Practice | BSC Perspective | Mentor' : 'Tema | Buena Practica | Perspectiva BSC | Mentor';
  const rows = BUENAS_PRACTICAS.map(function (p) {
    return p.tema + ' | ' + p.practica + ' | ' + p.perspectiva + ' | ' + p.mentor;
  });
  return header + '\n' + rows.join('\n');
}

function buildSystemPrompt(paso: PlanPaso, language: PlanLang): string {
  if (language === 'en') {
    if (paso === 'entornos') {
      return (
        'You are Babel, a strategic business architect. You receive (1) the current Strategic Objectives of the business ' +
        '(each with a unique id and its text), and (2) selected sections of the user strategic reflection: Phase 1 ' +
        '(SDG alignment and funding calls), Phase 2 (Environment analysis: localized PESTEL, Market Forces and Stakeholder ' +
        'Impact Matrix), and Phase 4 (5-Year Strategic Foresight).\n\n' +
        'Your task: work OBJECTIVE BY OBJECTIVE. For EACH Strategic Objective in the list, read its text and identify the ' +
        'CONCRETE Threats (that could prevent achieving it) and Opportunities (that could boost achieving it) supported by ' +
        'the given sections. Do not invent facts, do not report generic business statements: every Threat/Opportunity must ' +
        'name the specific factor from the reflection and must be explicitly tied to the objective whose achievement it ' +
        'directly affects (for example: a threat that raises the cost of a key input, closes a channel or changes a ' +
        'regulation that the objective depends on; an opportunity that opens a new market, funding, partnership or ' +
        'efficiency gain that the objective can capture).\n\n' +
        'Assignment rule: use the EXACT ids of the objectives the item affects. A SINGLE threat or opportunity MAY ' +
        'impact SEVERAL objectives (for example, a new regulation, a market change or an available funding call can ' +
        'affect more than one objective): in that case include ALL their ids in "objetivoIds" and DO NOT split it into ' +
        'repeated items. If it only impacts one objective, include only that id. Never invent ids, never leave the ' +
        'list empty. Cover as many objectives as possible: try to produce at least one Threat or Opportunity for every ' +
        'objective in the list.\n\n' +
        'Respond with ONLY a raw JSON array (no markdown fences, no prose before or after), between 3 and 12 items, ' +
        'where each item has EXACTLY this shape:\n' +
        '{"objetivoIds":["one or more of the given ids, ALL the objectives this item impacts; at least 1"],"tipo":"amenaza or oportunidad","descripcion":"one concrete, actionable sentence, max 200 characters"}'
      );
    }
    if (paso === 'fds') {
      return (
        'You are Babel, a strategic business architect. You receive (1) the Threats and Opportunities already registered ' +
        '(each with a unique id, type and description), (2) selected sections of the user strategic reflection: Phase 1 ' +
        '(Golden Circle and Value Proposition), Phase 3 (Key Capabilities and Operational Plan) and Phase 4 (Delta Model), ' +
        'and (3) OPTIONALLY the weaknesses detected in the low maturity levels of the business maturity assessment.\n\n' +
        'Your task: for each Threat or Opportunity propose ONE Strength of the company to exploit it (if it is an ' +
        'opportunity) or to mitigate it (if it is a threat). Additionally, using the maturity weaknesses list (if provided), ' +
        'propose relevant additional Weaknesses. Ground every item in the given text.\n\n' +
        'Each item must reference the EXACT ids of the Threats/Opportunities it links to, its type ("fortaleza" for a ' +
        'strength or "debilidad" for a weakness) and its description. A SINGLE strength or weakness MAY be linked to ' +
        'SEVERAL threats/opportunities (for example, one company capability can mitigate two threats or exploit two ' +
        'opportunities): in that case include ALL their ids in "entornoIds" and DO NOT split it into repeated items. ' +
        'If it only links to one, include only that id. Never invent ids, never leave the list empty.\n\n' +
        'Respond with ONLY a raw JSON array (no markdown fences), between 3 and 12 items, where each item has EXACTLY this shape:\n' +
        '{"entornoIds":["one or more exact ids of the threats or opportunities it links to; at least 1"],"tipo":"fortaleza or debilidad","descripcion":"max 200 characters"}'
      );
    }
    return (
      'You are Babel, a strategic business architect. You receive (1) the Strengths and Weaknesses already registered ' +
      '(each with a unique id, type and description), (2) the sections of the user strategic reflection, ' +
      '(3) OPTIONALLY the pending next steps of the maturity assessment, and (4) a catalog of business best practices ' +
      'with Theme, Best Practice, impacted BSC Perspective and suggested Mentor.\n\n' +
      'Your task: for each Strength propose actions to strengthen or leverage it, and for each Weakness propose actions ' +
      'to improve or fix it. Use the best practice catalog: when a catalog practice (filtered by Theme) applies to a ' +
      'Strength/Weakness, propose it as a concrete action. Also consider the pending maturity next steps. Actions must be ' +
      'concrete, achievable and with verifiable deliverable.\n\n' +
      'Each action must reference the EXACT id of the Strength/Weakness it addresses.\n\n' +
      'Respond with ONLY a raw JSON array (no markdown fences), between 3 and 20 items, where each item has EXACTLY this shape:\n' +
      '{"fdId":"exact id of the strength or weakness","descripcion":"concrete action, max 250 characters","entregable":"verifiable deliverable, max 150 characters"}'
    );
  }
  if (paso === 'entornos') {
    return (
      'Eres Babel, un arquitecto estrategico de negocios. Recibes (1) los Objetivos Estrategicos actuales del negocio ' +
      '(cada uno con un id unico y su texto), y (2) secciones seleccionadas de la reflexion estrategica del usuario: ' +
      'Fase 1 (Vinculacion con los ODS y Fondos), Fase 2 (Analisis del entorno: PESTEL Localizado, Fuerzas del Mercado y ' +
      'Matriz de Impacto en Stakeholders) y Fase 4 (Prospectiva a 5 Anos).\n\n' +
      'Tu tarea: trabaja OBJETIVO POR OBJETIVO. Para CADA Objetivo Estrategico de la lista, lee su texto e identifica ' +
      'las Amenazas CONCRETAS (que podrian impedir su logro) y las Oportunidades CONCRETAS (que podrian impulsarlo) ' +
      'sustentadas en las secciones dadas. No inventes hechos ni reportes frases genericas de negocio: cada Amenaza/' +
      'Oportunidad debe nombrar el factor especifico de la reflexion y debe quedar explicitamente ligada al objetivo ' +
      'cuyo logro afecta directamente (por ejemplo: una amenaza que encarece un insumo clave, cierra un canal o cambia ' +
      'una regulacion de la que depende el objetivo; una oportunidad que abre un nuevo mercado, fondeo, alianza o ' +
      'ahorro de eficiencia que el objetivo puede aprovechar).\n\n' +
      'Regla de asignacion: usa los ids EXACTOS de los objetivos impactados. UNA MISMA amenaza u oportunidad PUEDE ' +
      'impactar a VARIOS objetivos (por ejemplo, una regulacion nueva, un cambio de mercado o una convocatoria de ' +
      'fondos disponible pueden afectar a mas de uno): en ese caso incluye TODOS sus ids en "objetivoIds" y NO la ' +
      'dividas en elementos repetidos. Si solo impacta a uno, incluye unicamente su id. Nunca inventes ids, nunca ' +
      'dejes la lista vacia. Cubre la mayor cantidad de objetivos posible: procura al menos una Amenaza u Oportunidad ' +
      'por cada objetivo de la lista.\n\n' +
      'Responde UNICAMENTE con un arreglo JSON puro (sin marcadores de markdown, sin texto antes ni despues), entre 3 y 12 ' +
      'elementos, donde cada elemento tenga EXACTAMENTE esta forma:\n' +
      '{"objetivoIds":["uno o mas de los ids dados, TODOS los objetivos que este elemento impacta; minimo 1"],"tipo":"amenaza u oportunidad","descripcion":"una frase concreta y accionable, maximo 200 caracteres"}'
    );
  }
  if (paso === 'fds') {
    return (
      'Eres Babel, un arquitecto estrategico de negocios. Recibes (1) las Amenazas y Oportunidades ya registradas ' +
      '(cada una con id unico, tipo y descripcion), (2) secciones seleccionadas de la reflexion estrategica del usuario: ' +
      'Fase 1 (Circulo Dorado y Propuesta de Valor), Fase 3 (Capacidades Clave y Plan Operativo) y Fase 4 (Modelo Delta), ' +
      'y (3) OPCIONALMENTE las debilidades detectadas en los niveles bajos de la Evaluacion de Madurez del negocio.\n\n' +
      'Tu tarea: por cada Amenaza u Oportunidad propone UNA Fortaleza de la empresa para aprovecharla (si es oportunidad) ' +
      'o mitigarla (si es amenaza). Ademas, usando la lista de debilidades de madurez (si se proporciona), propone ' +
      'Debilidades adicionales relevantes. Sustenta cada elemento en el texto dado.\n\n' +
      'Cada elemento debe referenciar los ids EXACTOS de las Amenazas/Oportunidades a las que se vincula, su tipo ' +
      '("fortaleza" o "debilidad") y su descripcion. UNA MISMA fortaleza o debilidad PUEDE estar ligada a VARIAS ' +
      'amenazas u oportunidades (por ejemplo, una misma capacidad de la empresa puede mitigar dos amenazas o ' +
      'aprovechar dos oportunidades): en ese caso incluye TODOS sus ids en "entornoIds" y NO la dividas en elementos ' +
      'repetidos. Si solo se vincula a una, incluye unicamente su id. Nunca inventes ids, nunca dejes la lista vacia.\n\n' +
      'Responde UNICAMENTE con un arreglo JSON puro (sin marcadores de markdown), entre 3 y 12 elementos, donde cada ' +
      'elemento tenga EXACTAMENTE esta forma:\n' +
      '{"entornoIds":["uno o mas ids exactos de las amenazas u oportunidades a las que se vincula; minimo 1"],"tipo":"fortaleza o debilidad","descripcion":"maximo 200 caracteres"}'
    );
  }
  return (
    'Eres Babel, un arquitecto estrategico de negocios. Recibes (1) las Fortalezas y Debilidades ya registradas ' +
    '(cada una con id unico, tipo y descripcion), (2) las secciones de la reflexion estrategica del usuario, ' +
    '(3) OPCIONALMENTE los siguientes pasos pendientes de la Evaluacion de Madurez, y (4) un catalogo de buenas ' +
    'practicas de negocio con Tema, Buena Practica, Perspectiva del BSC que impacta y Mentor sugerido.\n\n' +
    'Tu tarea: por cada Fortaleza propone acciones para blindarla/aprovecharla, y por cada Debilidad propone acciones ' +
    'para mejorarla/corregirla. Usa el catalogo de buenas practicas: cuando una practica del catalogo (filtrada por ' +
    'Tema) aplique a la Fortaleza/Debilidad, proponla como accion concreta. Considera tambien los siguientes pasos ' +
    'pendientes de madurez. Las acciones deben ser concretas, realizables y con un entregable verificable.\n\n' +
    'Cada accion debe referenciar el id EXACTO de la Fortaleza/Debilidad que atiende.\n\n' +
    'Responde UNICAMENTE con un arreglo JSON puro (sin marcadores de markdown), entre 3 y 20 elementos, donde cada ' +
    'elemento tenga EXACTAMENTE esta forma:\n' +
    '{"fdId":"id exacto de la fortaleza o debilidad","descripcion":"accion concreta, maximo 250 caracteres","entregable":"entregable verificable, maximo 150 caracteres"}'
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
    const text =
      data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts &&
      data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text;
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
  return NextResponse.json({
    status: 'ok',
    route: '/api/babel/extractor-plan-accion',
    note: 'Plan de Accion: 3 pasos secuenciales de Babel (entornos, fds, acciones) con contexto dirigido y catalogo de Buenas Practicas',
  });
}

export async function POST(req: NextRequest) {
  let body: PlanAccionRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la solicitud invalido.' }, { status: 400 });
  }

  const language = body.language === 'en' ? 'en' : 'es';
  const paso: PlanPaso | null =
    body.paso === 'entornos' || body.paso === 'fds' || body.paso === 'acciones' ? body.paso : null;
  const objetivos = Array.isArray(body.objetivos) ? body.objetivos : [];
  const entornos = Array.isArray(body.entornos) ? body.entornos : [];
  const fds = Array.isArray(body.fds) ? body.fds : [];
  const contextoFases = typeof body.contextoFases === 'string' ? body.contextoFases.trim() : '';
  const madurezDebilidades = typeof body.madurezDebilidades === 'string' ? body.madurezDebilidades.trim() : '';
  const madurezPendientes = typeof body.madurezPendientes === 'string' ? body.madurezPendientes.trim() : '';

  if (!paso) {
    return NextResponse.json(
      { error: language === 'en' ? 'Missing step ("entornos", "fds" or "acciones").' : 'Falta el paso ("entornos", "fds" o "acciones").' },
      { status: 400 },
    );
  }

  if (paso === 'entornos' && objetivos.length === 0) {
    return NextResponse.json(
      {
        error:
          language === 'en'
            ? 'You need at least one Strategic Objective before detecting Threats/Opportunities.'
            : 'Necesitas al menos un Objetivo Estrategico antes de detectar Amenazas/Oportunidades.',
      },
      { status: 400 },
    );
  }
  if (paso === 'fds' && entornos.length === 0) {
    return NextResponse.json(
      {
        error:
          language === 'en'
            ? 'You need at least one Threat/Opportunity before suggesting Strengths/Weaknesses.'
            : 'Necesitas al menos una Amenaza/Oportunidad antes de sugerir Fortalezas/Debilidades.',
      },
      { status: 400 },
    );
  }
  if (paso === 'acciones' && fds.length === 0) {
    return NextResponse.json(
      {
        error:
          language === 'en'
            ? 'You need at least one Strength/Weakness before suggesting Actions.'
            : 'Necesitas al menos una Fortaleza/Debilidad antes de sugerir Acciones.',
      },
      { status: 400 },
    );
  }

  const systemPrompt = buildSystemPrompt(paso, language);
  const contextoRecortado =
    paso === 'acciones' ? contextoFases.slice(0, 20000) : contextoFases.slice(0, 14000);
  const madurezRecortada = (madurezDebilidades || madurezPendientes).slice(0, 5000);

  let userMessage = '';
  if (paso === 'entornos') {
    userMessage =
      (language === 'en' ? 'Strategic Objectives (JSON array):\n\n' : 'Objetivos Estrategicos (arreglo JSON):\n\n') +
      JSON.stringify(objetivos).slice(0, 4000) +
      (language === 'en'
        ? '\n\nSelected sections of the strategic reflection:\n\n'
        : '\n\nSecciones seleccionadas de la reflexion estrategica:\n\n') +
      contextoRecortado;
  } else if (paso === 'fds') {
    userMessage =
      (language === 'en' ? 'Threats and Opportunities (JSON array):\n\n' : 'Amenazas y Oportunidades (arreglo JSON):\n\n') +
      JSON.stringify(entornos).slice(0, 6000) +
      (language === 'en'
        ? '\n\nSelected sections of the strategic reflection:\n\n'
        : '\n\nSecciones seleccionadas de la reflexion estrategica:\n\n') +
      contextoRecortado;
    if (madurezDebilidades) {
      userMessage +=
        (language === 'en'
          ? '\n\nWeaknesses from low maturity levels (use as additional input):\n\n'
          : '\n\nDebilidades de niveles bajos de madurez (usar como insumo adicional):\n\n') + madurezRecortada;
    }
  } else {
    userMessage =
      (language === 'en' ? 'Strengths and Weaknesses (JSON array):\n\n' : 'Fortalezas y Debilidades (arreglo JSON):\n\n') +
      JSON.stringify(fds).slice(0, 6000) +
      (language === 'en' ? '\n\nStrategic reflection sections:\n\n' : '\n\nSecciones de la reflexion estrategica:\n\n') +
      contextoRecortado;
    if (madurezPendientes) {
      userMessage +=
        (language === 'en' ? '\n\nPending maturity next steps (optional):\n\n' : '\n\nSiguientes pasos pendientes de madurez (opcional):\n\n') +
        madurezRecortada;
    }
    userMessage +=
      (language === 'en' ? '\n\nBest practices catalog:\n\n' : '\n\nCatalogo de buenas practicas:\n\n') + buildTablaPracticas(language);
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

  const maxItems = paso === 'acciones' ? 20 : 12;
  return NextResponse.json({ sugerencias: result.slice(0, maxItems) });
}

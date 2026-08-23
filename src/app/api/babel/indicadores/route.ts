import { NextRequest, NextResponse } from 'next/server';
import { intentarRecargaIA, generarPedidoId } from '@/lib/ia-recarga';

// ---------------------------------------------------------------------------
// Ruta NUEVA e independiente. NO modifica src/app/api/babel/route.ts (esa
// ruta ya esta probada en produccion y no se toca). Esta ruta reutiliza los
// MISMOS nombres de variables de entorno que la ruta principal de Babel para
// que funcione sin necesidad de configurar nada nuevo en Vercel:
//   FALLBACK_ENDPOINT / FALLBACK_MODEL / FALLBACK_API_KEY   -> Groq (2do intento)
//   TERTIARY_ENDPOINT / TERTIARY_MODEL / TERTIARY_API_KEY   -> OpenRouter (3er intento)
//   GEMINI_MODEL / GEMINI_API_KEY                            -> Gemini (1er intento, paga)
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

interface Diagnostic {
  provider: string;
  status: string;
  error?: string;
}

interface IndicadoresRequestBody {
  language?: 'es' | 'en';
  financialContext?: string;
}

// ---------------------------------------------------------------------------
// CATALOGO OBLIGATORIO DE OBJETIVOS BALANCED SCORECARD. Babel SOLO sustituye
// el contenido de los corchetes [ ] por valores concretos (financieros cuando
// se proporcionan); el "nombre" y el resto de la redaccion quedan verbatim.
// ---------------------------------------------------------------------------
const CATALOGO_ES = `CATALOGO OBLIGATORIO DE OBJETIVOS BALANCED SCORECARD (5 perspectivas):
Para cada objetivo usa EXACTAMENTE el "nombre" de la lista y la "redaccion" tal como aparece: tu UNICA intervencion es sustituir SOLO el contenido de los corchetes [ ] por valores concretos y realistas, usando los datos financieros del contexto cuando existan. No cambies ninguna otra palabra del texto.

FINANCIERA (Dinero del negocio):
- "Ingresos (Ventas)": "Aumentar las ventas de [punto de equilibrio definido] a [ingreso meta] pesos mensuales en 12 meses."
- "Gastos Fijos": "Reducir los gastos fijos en x% [meta para acelerar la utilidad deseada] con relación a los ingresos en 12 meses."
- "Gastos Variables": "Reducir los gastos variables en x% [% realista de los ya calculados] con relación a los ingresos en 12 meses."
- "Utilidad (Ganancia real)": "Lograr [utilidad deseada definida] mensuales en 12 meses."

CLIENTES:
- "Satisfacción de clientes": "Mantener al 95% de clientes satisfechos mensual en los siguientes 12 meses."
- "Quejas de clientes": "Menos de 2 quejas de clientes mensuales en los siguientes 12 meses"
- "Número de Clientes al Mes": "Captar [número de clientes necesarios al mes para alcanzar la meta en 12 meses por canal de ingresos] clientes nuevos cada mes en los siguientes 12 meses."
- "Cartera Vencida (Cuentas por cobrar)": "Reducir a menos del 10% la cartera vencida de clientes mensual en los siguientes 12 meses."

PROCESOS INTERNOS (Cómo trabajamos):
- "Tiempo de Entrega": "Cumplir al 95% las entregas mensuales al cliente comprometidas en los siguientes 12 meses."
- "Calidad del Producto": "Disminuir a menos del 5% los rechazos por parte del cliente del [producto y/o servicio dependiendo del giro y productos o servicios declarados] mensuales en los siguientes 12 meses."
- "Atención a requerimientos y problemas": "Cumplir mensualmente al 95% en tiempo y forma la solución de los requerimientos y problemas reportados por el cliente que no estén contemplados en [el producto y/o servicio declarados en las etapas anteriores] en los siguientes 12 meses."

APRENDIZAJE Y CONOCIMIENTO (Nuestro equipo):
- "Retención de Personal": "Reducir al 3% mensual la rotación del personal en los siguientes 12 meses."
- "Desempeño": "Incrementar a 95% de cumplimiento mensual del personal en sus objetivos individuales en los siguientes 12 meses."
- "Capacitación": "Lograr que el 100% del personal cumpla su plan de capacitación en los siguientes 12 meses."
- "Clima Laboral": "Incrementar a 95% de personal satisfecho en los siguientes 12 meses."

SOCIOAMBIENTAL:
- "Descarbonización (NIIF S2 - Reducción de contaminación)": "Disminuir la huella de carbono en un 50% en emisiones alcance 1 (combustión propia, flotillas) y Alcance 2 (electricidad consumida) en los siguientes 12 meses."
- "Gobernanza y Transparencia (NIIF S1 - Reglas y registros claros)": "Registrar el 100% de los impactos a los grupos de interés mensualmente en los siguientes 12 meses."
- "Economía Circular e Impacto Financiero (NIIF S1/S2)": "Separar y vender o reusar el x% de [proponer el porcentaje y los residuos o productos de acuerdo al giro] mensualmente en los siguientes 12 meses."`;

const CATALOGO_EN = `MANDATORY BALANCED SCORECARD OBJECTIVE CATALOG (5 perspectives):
For each objective use EXACTLY the "name" from the list and the "wording" as it appears: your ONLY intervention is to substitute ONLY the content of the square brackets [ ] with concrete, realistic values, using the financial data from the context when available. Do not change any other word of the text.

FINANCIAL (Business money):
- "Income (Sales)": "Increase sales from [defined break-even point] to [goal revenue] pesos per month in 12 months."
- "Fixed Expenses": "Reduce fixed expenses by x% [target to accelerate the desired profit] relative to income in 12 months."
- "Variable Expenses": "Reduce variable expenses by x% [realistic percentage of the already calculated ones] relative to income in 12 months."
- "Profit (Real Earnings)": "Achieve [defined desired profit] per month in 12 months."

CUSTOMERS:
- "Customer Satisfaction": "Keep 95% of customers satisfied monthly over the next 12 months."
- "Customer Complaints": "Fewer than 2 customer complaints per month over the next 12 months."
- "Number of Customers per Month": "Attract [number of new customers needed per month to reach the goal in 12 months per income channel] new customers each month over the next 12 months."
- "Overdue Portfolio (Accounts Receivable)": "Reduce the overdue customer portfolio to under 10% monthly over the next 12 months."

INTERNAL PROCESSES (How we work):
- "Delivery Time": "Meet 95% of the monthly deliveries committed to the customer over the next 12 months."
- "Product Quality": "Reduce customer rejections of [product and/or service depending on the business type and the declared products or services] to under 5% monthly over the next 12 months."
- "Requirements and Issues Response": "Monthly, resolve 95% of customer requirements and reported issues on time and properly that are not covered by [the product and/or service declared in the previous stages] over the next 12 months."

LEARNING AND GROWTH (Our team):
- "Staff Retention": "Reduce monthly staff turnover to 3% over the next 12 months."
- "Performance": "Increase monthly staff compliance with their individual objectives to 95% over the next 12 months."
- "Training": "Ensure that 100% of staff complete their training plan over the next 12 months."
- "Work Climate": "Increase satisfied staff to 95% over the next 12 months."

SOCIAL-ENVIRONMENTAL:
- "Decarbonization (IFRS S2 - Pollution reduction)": "Reduce the carbon footprint by 50% in scope 1 emissions (own combustion, fleets) and Scope 2 (consumed electricity) over the next 12 months."
- "Governance and Transparency (IFRS S1 - Clear rules and records)": "Record 100% of stakeholder impacts monthly over the next 12 months."
- "Circular Economy and Financial Impact (IFRS S1/S2)": "Separate and sell or reuse x% of [propose the percentage and the waste or products according to the business type] monthly over the next 12 months."`;

function buildSystemPrompt(language: 'es' | 'en'): string {
  const catalog = language === 'en' ? CATALOGO_EN : CATALOGO_ES;
  if (language === 'en') {
    return (
      'You are Babel, a strategic business architect. The user defines Balanced Scorecard strategic objectives from a standard catalog ' +
      'and gives you their saved financial goals as context.\n\n' +
      'Your task: propose between 10 and 18 strategic objectives from the catalog below, covering ALL 5 perspectives ' +
      '(at least 2 per perspective, and ALWAYS all 4 financial ones when financial data exists). For each one, ' +
      'copy the exact "name" and the exact "wording", replacing ONLY the [bracketed] parts with concrete, realistic values ' +
      '(use the financial context values for the financial perspective; otherwise propose plausible values for the declared income channels). ' +
      'Do NOT add, remove or reword any other part of the wording.\n\n' +
      'For each objective add: a concrete "formula" (with units), a concrete "meta" (target value), a "unidadMedida" ' +
      '(e.g. "$", "%", "customers/month", "complaints/month") and "frecuencia" ("mensual" for these objectives).\n\n' +
      'Respond with ONLY a raw JSON array (no markdown fences, no prose before or after) where each item has EXACTLY this shape:\n' +
      '{"perspectiva":"financiera or clientes or procesos_internos or aprendizaje_crecimiento or socioambiental","nombre":"objective name from the catalog","objetivo":"exact catalog wording with only the bracketed parts filled in","formula":"calculation formula","meta":"target value","unidadMedida":"unit of measure","frecuencia":"mensual"}\n\n' +
      catalog
    );
  }
  return (
    'Eres Babel, un arquitecto estrategico de negocios. El usuario define objetivos estrategicos Balanced Scorecard a partir de un catalogo ' +
    'estandar y te da sus objetivos financieros guardados como contexto.\n\n' +
    'Tu tarea: propone entre 10 y 18 objetivos estrategicos del catalogo de abajo, cubriendo TODAS las 5 perspectivas ' +
    '(al menos 2 por perspectiva, y SIEMPRE los 4 de la financiera cuando existan datos financieros). Para cada uno, ' +
    'copia el "nombre" y la "redaccion" exactos, sustituyendo SOLO las partes entre corchetes [ ] por valores concretos y realistas ' +
    '(usa los valores del contexto financiero para la perspectiva financiera; si no hay datos, propone valores plausibles para los canales declarados). ' +
    'NO agregues, quites ni reformules ninguna otra parte de la redaccion.\n\n' +
    'Para cada objetivo agrega: una "formula" concreta (con unidades), una "meta" concreta (valor objetivo), una "unidadMedida" ' +
    '(p.ej. "$", "%", "clientes/mes", "quejas/mes") y "frecuencia" ("mensual" para estos objetivos).\n\n' +
    'Responde UNICAMENTE con un arreglo JSON puro (sin marcadores de markdown, sin texto antes ni despues) donde cada elemento tenga EXACTAMENTE esta forma:\n' +
    '{"perspectiva":"financiera o clientes o procesos_internos o aprendizaje_crecimiento o socioambiental","nombre":"nombre del objetivo del catalogo","objetivo":"redaccion exacta del catalogo con solo las partes entre corchetes completadas","formula":"formula de calculo","meta":"valor objetivo","unidadMedida":"unidad de medida","frecuencia":"mensual"}\n\n' +
    catalog
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
        generationConfig: { temperature: 0.4, maxOutputTokens: 4096 },
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
        temperature: 0.4,
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
  return NextResponse.json({ status: 'ok', route: '/api/babel/indicadores', note: 'Propuesta de objetivos Balanced Scorecard' });
}

// Objetivos de la perspectiva Normatividad: son fijos y exactos (no tienen
// partes entre corchetes que la IA deba completar), asi que se agregan de
// forma deterministica en cada respuesta, sin depender de ningun proveedor
// de IA. Deben aparecer siempre que se presione "Generar propuesta con Babel".
function objetivosNormatividadFijos(language: 'es' | 'en'): Record<string, string>[] {
  if (language === 'en') {
    return [
      {
        perspectiva: 'normatividad',
        nombre: '% of regulatory compliance',
        formula: 'Number of resolved regulatory risks / Total risks',
        objetivo: 'Reach 90% regulatory compliance within 12 months',
        meta: '90',
        unidadMedida: '%',
        frecuencia: 'mensual',
      },
      {
        perspectiva: 'normatividad',
        nombre: 'Fines received',
        formula: 'Amount of fines received',
        objetivo: 'Reduce fines from authorities to $0 within 12 months',
        meta: '0',
        unidadMedida: '$',
        frecuencia: 'mensual',
      },
    ];
  }
  return [
    {
      perspectiva: 'normatividad',
      nombre: '% de cumplimiento normativo',
      formula: 'Numero de riesgos normativos cumplidos / Total de riesgos',
      objetivo: 'Alcanzar el 90% de cumplimiento normativo en 12 meses',
      meta: '90',
      unidadMedida: '%',
      frecuencia: 'mensual',
    },
    {
      perspectiva: 'normatividad',
      nombre: 'Multas recibidas',
      formula: 'Monto de multas recibidas',
      objetivo: 'Reducir a $0 multas de las autoridades en 12 meses',
      meta: '0',
      unidadMedida: '$',
      frecuencia: 'mensual',
    },
  ];
}

export async function POST(req: NextRequest) {
  let body: IndicadoresRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la solicitud invalido.' }, { status: 400 });
  }

  const language = body.language === 'en' ? 'en' : 'es';
  const financialContext = (body.financialContext || '').slice(0, 4000);

  const systemPrompt = buildSystemPrompt(language);
  const userMessage =
    (language === 'en'
      ? 'Financial goals context (use these values for the [bracketed] parts of the financial perspective):\n\n'
      : 'Contexto de objetivos financieros (usa estos valores para las partes entre [corchetes] de la perspectiva financiera):\n\n') +
    (financialContext.trim()
      ? financialContext
      : language === 'en'
        ? 'No financial goals have been saved yet. Propose realistic values for the business (income channels, ticket size, etc.).'
        : 'Aun no hay objetivos financieros guardados. Propone valores realistas para el negocio (canales de ingreso, ticket promedio, etc.).');

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

  const normatividadFijos = objetivosNormatividadFijos(language);

  if (!result) {
    // Aunque ningun proveedor de IA respondio, los dos objetivos fijos de
    // Normatividad se devuelven igual: no dependen de la IA y el usuario
    // pidio que aparezcan siempre que se presione "Generar propuesta con Babel".
    return NextResponse.json({
      indicadores: normatividadFijos,
      aiError:
        language === 'en'
          ? 'None of the configured AI providers could generate the rest of the proposal.'
          : 'Ninguno de los proveedores de IA configurados pudo generar el resto de la propuesta.',
      diagnostics: diagnostics,
    });
  }

  return NextResponse.json({ indicadores: [...normatividadFijos, ...result].slice(0, 18) });
}

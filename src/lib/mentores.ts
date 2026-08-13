import { BUENAS_PRACTICAS } from './buenas-practicas';

// ---------------------------------------------------------------------------
// src/lib/mentores.ts
//
// Logica compartida para el sistema de "agente que puede ayudar con cada
// accion" del Plan de Accion:
//   - Los 5 mentores de IA (mismos ids que AgentAvatar.tsx).
//   - Emparejamiento de una accion con un mentor usando el catalogo de
//     BUENAS_PRACTICAS (src/lib/buenas-practicas.ts) como fuente principal.
//   - Construccion del system prompt de cada mentor (modo tip / modo chat).
//   - Llamada a los proveedores de IA en cascada (Gemini -> Groq ->
//     OpenRouter -> DeepSeek), reutilizando las mismas variables de entorno
//     que src/app/api/babel/route.ts. Solo Gemini soporta busqueda web
//     nativa (Google Search grounding) en este stack; en los demas
//     proveedores el mentor responde sin citar fuentes en vez de inventarlas.
// ---------------------------------------------------------------------------

export type MentorId = 'Babel' | 'Karmetin' | 'Normau' | 'Fisnando' | 'Atech';

export const MENTOR_IDS: MentorId[] = ['Babel', 'Karmetin', 'Normau', 'Fisnando', 'Atech'];

export function esMentorValido(valor: unknown): valor is MentorId {
  return typeof valor === 'string' && (MENTOR_IDS as string[]).indexOf(valor) !== -1;
}

function normalizar(txt: string): string {
  return txt
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// Empareja el texto de una accion contra el catalogo de Buenas Practicas por
// coincidencia de palabras del Tema/Practica. Devuelve null si no hay
// coincidencia clara (el llamador debe usar clasificacion por IA como
// respaldo, tal como pidio el usuario).
export function matchMentorPorTexto(texto: string): MentorId | null {
  const t = normalizar(texto || '');
  if (!t) return null;
  let mejorMentor: MentorId | null = null;
  let mejorPuntos = 0;
  BUENAS_PRACTICAS.forEach((bp) => {
    if (!esMentorValido(bp.mentor)) return;
    const palabras = normalizar(bp.tema + ' ' + bp.practica)
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 3);
    let puntos = 0;
    palabras.forEach((w) => {
      if (t.indexOf(w) !== -1) puntos = puntos + 1;
    });
    if (puntos > mejorPuntos) {
      mejorPuntos = puntos;
      mejorMentor = bp.mentor as MentorId;
    }
  });
  return mejorMentor;
}

// Mapea la perspectiva del Balanced Scorecard del objetivo (ver PERSPECTIVAS
// en src/lib/plan-accion.ts) al mentor que le corresponde. Se usa como
// segundo respaldo cuando el catalogo de Buenas Practicas no encuentra
// coincidencia: Financieros -> Fisnando, Clientes -> Karmetin, Procesos ->
// Atech, Aprendizaje -> Babel, Socioambientales -> Normau.
export const PERSPECTIVA_MENTOR: Record<string, MentorId> = {
  financiera: 'Fisnando',
  clientes: 'Karmetin',
  procesos_internos: 'Atech',
  aprendizaje_crecimiento: 'Babel',
  socioambiental: 'Normau',
};

export function mentorPorPerspectiva(perspectiva: string): MentorId | null {
  const key = (perspectiva || '').trim();
  if (!key) return null;
  const mentor = PERSPECTIVA_MENTOR[key];
  return mentor || null;
}

// ---------------------------------------------------------------------------
// System prompts por mentor
// ---------------------------------------------------------------------------

interface AccionContexto {
  descripcion: string;
  entregable?: string;
}

const PERSONAS: Record<MentorId, { es: string; en: string }> = {
  Babel: {
    es: 'Eres Babel, mentor de Rumbo Estrategico, Capital Humano y Cultura Organizacional. Eres inteligente y te importa genuinamente ayudar.',
    en: 'You are Babel, mentor for Strategic Direction, Human Capital and Organizational Culture. You are smart and genuinely care about helping.',
  },
  Karmetin: {
    es: 'Eres Karmetin, mentora de Marketing y Ventas, y Atencion al Cliente. Eres creativa y servicial.',
    en: 'You are Karmetin, mentor for Marketing and Sales, and Customer Care. You are creative and service-minded.',
  },
  Normau: {
    es: 'Eres Normau, mentor de Cumplimiento Normativo, Alianzas y Enfoque Socioambiental. Eres responsable y te preocupas por la gente.',
    en: 'You are Normau, mentor for Regulatory Compliance, Partnerships and Social-Environmental Focus. You are responsible and care about people.',
  },
  Fisnando: {
    es: 'Eres Fisnando, mentor de Finanzas y temas Fiscales. Eres ambicioso y cumplido.',
    en: 'You are Fisnando, mentor for Finance and Tax matters. You are ambitious and reliable.',
  },
  Atech: {
    es: 'Eres Atech, mentor de Operacion, Conocimiento y Digitalizacion. Eres geek y muy estructurado.',
    en: 'You are Atech, mentor for Operations, Knowledge and Digitalization. You are a structured geek.',
  },
};

const AREAS_MENTOR: Record<MentorId, { es: string; en: string }> = {
  Babel: { es: 'Rumbo Estrategico, Capital Humano y Cultura', en: 'Strategy, People and Culture' },
  Karmetin: { es: 'Marketing, Ventas y Atencion al Cliente', en: 'Marketing, Sales and Customer Care' },
  Normau: { es: 'Cumplimiento Normativo, Alianzas y Enfoque Socioambiental', en: 'Compliance, Partnerships and ESG' },
  Fisnando: { es: 'Finanzas y Fiscal', en: 'Finance and Tax' },
  Atech: { es: 'Operacion, Conocimiento y Digitalizacion', en: 'Operations, Knowledge and Digital' },
};

// El agente solo conoce el texto de ESTA accion puntual (nunca el plan
// completo), solo responde de ese tema y temas relacionados, y si el
// usuario pregunta algo de otra area lo redirige al mentor correcto.
export function buildMentorSystemPrompt(
  mentor: MentorId,
  language: 'es' | 'en',
  modo: 'tip' | 'chat',
  accion: AccionContexto,
): string {
  const persona = PERSONAS[mentor][language];
  const otros = MENTOR_IDS.filter((m) => m !== mentor)
    .map((m) => `${m} (${AREAS_MENTOR[m][language]})`)
    .join(', ');

  if (language === 'en') {
    const alcance =
      `Your ONLY context is this action: "${accion.descripcion}"` +
      (accion.entregable ? ` (deliverable: "${accion.entregable}")` : '') +
      `. Only answer about this specific topic and closely related topics — never the rest of the action plan. ` +
      `If the user asks about a different area, answer in ONE line that it should be discussed with ${otros}, and do not develop that topic yourself.`;
    if (modo === 'tip') {
      return `${persona}\n${alcance}\nGive exactly ONE short, concrete, actionable tip (max 4 lines, no markdown headers, no lists) to help implement this action. No web search needed for this quick tip.`;
    }
    return (
      `${persona}\n${alcance}\n` +
      `Chat mode: search the internet for how to implement this action, then answer briefly (max 5-6 lines). ` +
      `Close with 1-3 references in the exact format "Source: [title] — [URL]". ` +
      `Never invent a source — if you find nothing reliable, say so plainly and give your best recommendation without citing.`
    );
  }

  const alcance =
    `Tu UNICO contexto es esta accion: "${accion.descripcion}"` +
    (accion.entregable ? ` (entregable: "${accion.entregable}")` : '') +
    `. Solo respondes sobre este tema puntual y temas directamente relacionados — nunca sobre el resto del plan de accion. ` +
    `Si el usuario pregunta algo de otra area, responde en UNA linea que lo consulte con ${otros}, y no desarrolles tu ese tema.`;
  if (modo === 'tip') {
    return `${persona}\n${alcance}\nDa EXACTAMENTE UN tip breve, concreto y accionable (maximo 4 lineas, sin encabezados markdown, sin listas) para ayudar a implementar esta accion. No necesitas buscar en internet para este tip rapido.`;
  }
  return (
    `${persona}\n${alcance}\n` +
    `Modo chat: busca en internet como implementar esta accion y responde breve (maximo 5-6 lineas). ` +
    `Cierra con 1-3 referencias en el formato exacto "Fuente: [titulo] — [URL]". ` +
    `Nunca inventes una fuente — si no encuentras nada confiable, dilo claramente y da tu mejor recomendacion sin citar.`
  );
}

// ---------------------------------------------------------------------------
// Proveedores de IA en cascada (misma logica que src/app/api/babel/route.ts)
// ---------------------------------------------------------------------------

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const FALLBACK_ENDPOINT = process.env.FALLBACK_ENDPOINT || 'https://api.groq.com/openai/v1/chat/completions';
const FALLBACK_MODEL = process.env.FALLBACK_MODEL || 'llama-3.3-70b-versatile';

const TERTIARY_ENDPOINT = process.env.TERTIARY_ENDPOINT || 'https://openrouter.ai/api/v1/chat/completions';
const TERTIARY_MODEL = process.env.TERTIARY_MODEL || 'openai/gpt-oss-20b:free';

const DEEPSEEK_ENDPOINT = process.env.DEEPSEEK_ENDPOINT || 'https://api.deepseek.com/chat/completions';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

export interface MentorChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface MentorLLMResult {
  reply: string;
  usedSearch: boolean;
}

async function tryGeminiMentor(
  systemPrompt: string,
  mensajes: MentorChatMessage[],
  allowSearch: boolean,
): Promise<MentorLLMResult | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const contents = mensajes.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  try {
    const body: Record<string, unknown> = {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: { temperature: 0.5, maxOutputTokens: 1024 },
    };
    if (allowSearch) body.tools = [{ googleSearch: {} }];
    const res = await fetch(GEMINI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error('[mentores] Gemini error', res.status, (await res.text()).slice(0, 200));
      return null;
    }
    const data = await res.json();
    const text =
      data?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text ?? '')
        .join('') ?? '';
    if (!text) return null;
    return { reply: text, usedSearch: allowSearch };
  } catch (err) {
    console.error('[mentores] Gemini fetch exception:', err);
    return null;
  }
}

async function tryOpenAICompatibleMentor(
  systemPrompt: string,
  mensajes: MentorChatMessage[],
  endpoint: string,
  model: string,
  apiKey: string | undefined,
  label: string,
): Promise<MentorLLMResult | null> {
  if (!apiKey) return null;
  const msgs = [{ role: 'system', content: systemPrompt }, ...mensajes.map((m) => ({ role: m.role, content: m.content }))];
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages: msgs, temperature: 0.5, max_tokens: 1024 }),
    });
    if (!res.ok) {
      console.error(`[mentores] ${label} error`, res.status, (await res.text()).slice(0, 200));
      return null;
    }
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content ?? '';
    if (!text) return null;
    return { reply: text, usedSearch: false };
  } catch (err) {
    console.error(`[mentores] ${label} fetch exception:`, err);
    return null;
  }
}

// Intenta los proveedores en cascada. Solo Gemini soporta busqueda web real
// (allowSearch); en el resto se ignora y el mentor responde sin citas en vez
// de inventarlas (asi lo indica el propio system prompt).
export async function callMentorLLM(
  systemPrompt: string,
  mensajes: MentorChatMessage[],
  allowSearch: boolean,
): Promise<MentorLLMResult | null> {
  const r1 = await tryGeminiMentor(systemPrompt, mensajes, allowSearch);
  if (r1) return r1;

  const r2 = await tryOpenAICompatibleMentor(systemPrompt, mensajes, FALLBACK_ENDPOINT, FALLBACK_MODEL, process.env.FALLBACK_API_KEY, 'Groq');
  if (r2) return r2;

  const r3 = await tryOpenAICompatibleMentor(systemPrompt, mensajes, TERTIARY_ENDPOINT, TERTIARY_MODEL, process.env.TERTIARY_API_KEY, 'OpenRouter');
  if (r3) return r3;

  const r4 = await tryOpenAICompatibleMentor(systemPrompt, mensajes, DEEPSEEK_ENDPOINT, DEEPSEEK_MODEL, process.env.DEEPSEEK_API_KEY, 'DeepSeek');
  if (r4) return r4;

  return null;
}

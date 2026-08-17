import { NextRequest, NextResponse } from 'next/server';
import { intentarRecargaIA, generarPedidoId } from '@/lib/ia-recarga';

// ---------------------------------------------------------------------------
// Ruta para traducir el documento del Plan Estrategico Compilado al idioma
// de la interfaz, conservando el Markdown EXACTO (encabezados, tablas con
// pipes, listas, negritas y separadores) porque el renderer de PDF dibuja
// directamente desde ese Markdown.
//
// NOTA: no se usa /api/translate (Google) porque traduce con format:'text' y
// destroza la estructura de las tablas (pipes y filas de separacion). Aqui se
// traduce con la misma cadena de proveedores de IA del resto de Babel:
//   GEMINI_API_KEY            -> Gemini (1ro, paga)
//   FALLBACK_API_KEY (Groq)   -> 2do intento
//   TERTIARY_API_KEY (OpenRouter) -> 3ro
//   DEEPSEEK_API_KEY          -> DeepSeek (4to, paga)
// ---------------------------------------------------------------------------

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/' + GEMINI_MODEL + ':generateContent';

const FALLBACK_ENDPOINT = process.env.FALLBACK_ENDPOINT || 'https://api.groq.com/openai/v1/chat/completions';
const FALLBACK_MODEL = process.env.FALLBACK_MODEL || 'openai/gpt-oss-120b';

const TERTIARY_ENDPOINT = process.env.TERTIARY_ENDPOINT || 'https://openrouter.ai/api/v1/chat/completions';
const TERTIARY_MODEL = process.env.TERTIARY_MODEL || 'openai/gpt-oss-20b:free';

const DEEPSEEK_ENDPOINT = process.env.DEEPSEEK_ENDPOINT || 'https://api.deepseek.com/chat/completions';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

type TraducirLang = 'es' | 'en';

interface TraducirBody {
  text?: string;
  language?: TraducirLang;
}

interface Diagnostic {
  provider: string;
  status: string;
  error?: string;
}

function buildSystemPrompt(language: TraducirLang): string {
  if (language === 'en') {
    return (
      'You are a professional translator specialized in business strategy documents. Translate the user document ' +
      'verbatim into ENGLISH, faithfully and naturally.\n\n' +
      'CRITICAL RULES:\n' +
      '1. Preserve EXACTLY the Markdown structure: headings (#, ##, ###), tables with pipes (|) and their separator row ' +
      '(|---|---|---|), bullet or numbered lists (-, 1.), bold (**text**), horizontal separators (---) and blank lines. ' +
      'Do not change, add, remove or reformat any structural character. The document is rendered to PDF directly from ' +
      'this Markdown, so a broken structure breaks the layout.\n' +
      '2. Do not translate proper nouns: brand names, company names, product names, people, cities, states, countries ' +
      'or institutions. Keep them exactly as written.\n' +
      '3. Keep numbers, currencies, percentages, dates and codes exactly as they are; adjust only the text around them.\n' +
      '4. Keep the same meaning, the same paragraph breaks and the same order of sections.\n' +
      '5. Answer with ONLY the translated document. No comments, no explanations, no code fences, no text before or after.'
    );
  }
  return (
    'Eres un traductor profesional especializado en documentos de estrategia de negocios. Traduce el documento del ' +
    'usuario al ESPANOL, de forma fiel y natural.\n\n' +
    'REGLAS CRITICAS:\n' +
    '1. Conserva EXACTAMENTE la estructura Markdown: encabezados (#, ##, ###), tablas con pipes (|) y su fila de ' +
    'separacion (|---|---|---|), listas con viñetas o numeradas (-, 1.), negritas (**texto**), separadores (---) y ' +
    'lineas en blanco. No cambies, agregues, quites ni reformatees ningun caracter estructural. El documento se ' +
    'renderiza a PDF directamente desde este Markdown y una estructura rota rompe el layout.\n' +
    '2. No traduzcas nombres propios: marcas, nombres de empresas, productos, personas, ciudades, estados, paises o ' +
    'instituciones. Dejalos exactamente como estan escritos.\n' +
    '3. Conserva numeros, monedas, porcentajes, fechas y claves tal cual; ajusta solo el texto que los rodea.\n' +
    '4. Manten el mismo significado, los mismos saltos de linea entre parrafos y el mismo orden de secciones.\n' +
    '5. Responde SOLO con el documento traducido. Sin comentarios, sin explicaciones, sin cercos de codigo, sin texto ' +
    'antes ni despues.'
  );
}

async function tryGemini(systemPrompt: string, userMessage: string, diagnostics: Diagnostic[], reintento = false, pedidoId?: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(GEMINI_ENDPOINT + '?key=' + apiKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userMessage }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 8192 },
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
    const text =
      data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts &&
      data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text;
    if (!text) {
      diagnostics.push({ provider: 'gemini', status: 'empty_response' });
      return null;
    }
    diagnostics.push({ provider: 'gemini', status: 'ok' });
    return text;
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
): Promise<string | null> {
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
        temperature: 0.2,
        max_tokens: 8192,
      }),
    });
    const data = await res.json();
    if (!res.ok && (res.status === 429 || res.status === 402) && !reintento) {
      const rec = await intentarRecargaIA(label, pedidoId || generarPedidoId());
      if (rec.recargada) return tryOpenAICompatible(systemPrompt, userMessage, endpoint, model, apiKey, label, diagnostics, true, pedidoId);
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
    diagnostics.push({ provider: label, status: 'ok' });
    return text;
  } catch (err) {
    diagnostics.push({ provider: label, status: 'exception', error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    route: '/api/babel/traducir-plan',
    note: 'Traduce el plan compilado conservando el Markdown exacto para el PDF.',
  });
}

export async function POST(req: NextRequest) {
  let body: TraducirBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la solicitud invalido.' }, { status: 400 });
  }

  const language: TraducirLang = body.language === 'en' ? 'en' : 'es';
  const text = typeof body.text === 'string' ? body.text.trim() : '';

  if (!text) {
    return NextResponse.json({ translation: '' });
  }

  const systemPrompt = buildSystemPrompt(language);
  const userMessage =
    (language === 'en' ? 'DOCUMENT TO TRANSLATE — translate the whole document into English:\n\n' : 'DOCUMENTO A TRADUCIR — traduce todo el documento al espanol:\n\n') +
    text.slice(0, 30000);

  const diagnostics: Diagnostic[] = [];

  let translated: string | null = await tryGemini(systemPrompt, userMessage, diagnostics);

  if (!translated) {
    translated = await tryOpenAICompatible(systemPrompt, userMessage, FALLBACK_ENDPOINT, FALLBACK_MODEL, process.env.FALLBACK_API_KEY, 'groq', diagnostics);
  }
  if (!translated) {
    translated = await tryOpenAICompatible(systemPrompt, userMessage, TERTIARY_ENDPOINT, TERTIARY_MODEL, process.env.TERTIARY_API_KEY, 'openrouter', diagnostics);
  }
  if (!translated) {
    translated = await tryOpenAICompatible(systemPrompt, userMessage, DEEPSEEK_ENDPOINT, DEEPSEEK_MODEL, process.env.DEEPSEEK_API_KEY, 'deepseek', diagnostics);
  }

  if (!translated) {
    return NextResponse.json(
      {
        error:
          language === 'en'
            ? 'None of the configured AI providers could translate the document.'
            : 'Ninguno de los proveedores de IA configurados pudo traducir el documento.',
        diagnostics: diagnostics,
        tip:
          language === 'en'
            ? 'Check that GEMINI_API_KEY, FALLBACK_API_KEY (Groq), TERTIARY_API_KEY (OpenRouter) or DEEPSEEK_API_KEY are set in Vercel.'
            : 'Verifica que GEMINI_API_KEY, FALLBACK_API_KEY (Groq), TERTIARY_API_KEY (OpenRouter) o DEEPSEEK_API_KEY esten configuradas en Vercel.',
      },
      { status: 502 },
    );
  }

  const cleaned = translated
    .trim()
    .replace(/^```(?:markdown|md|text)?\s*/i, '')
    .replace(/\s*```$/i, '');

  return NextResponse.json({ translation: cleaned });
}
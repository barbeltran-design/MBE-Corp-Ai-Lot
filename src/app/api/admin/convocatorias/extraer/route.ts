import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/server-roles';

// POST /api/admin/convocatorias/extraer — recibe { url }, descarga esa pagina
// del lado del servidor, le quita HTML/scripts/estilos, y le pide a un modelo
// de IA que saque los datos de la convocatoria en el mismo formato que usa
// src/lib/convocatorias-data.ts (Convocatoria + criterios). Es SOLO el primer
// paso ("Extraer datos"): el administrador revisa/edita el resultado en
// /admin antes de publicarlo con POST /api/admin/convocatorias.
//
// Comparte el mismo patron de "varios proveedores de respaldo" que
// src/app/api/babel/extractor-convocatorias/route.ts (Gemini -> Groq/FALLBACK
// -> OpenRouter/TERTIARY -> DeepSeek), pero sin la logica de recarga por
// creditos (intentarRecargaIA) porque esta ruta es una herramienta interna de
// administracion, no una funcion pagada de un usuario final.

interface Diagnostic {
  provider: string;
  status: string;
  error?: string;
}

const SYSTEM_PROMPT = `Eres un asistente que extrae datos de convocatorias (fondos, premios, apoyos, becas) de paginas web para una base de datos.

Con el texto de la pagina que te doy, responde UNICAMENTE con un objeto JSON (nada de texto antes o despues, nada de bloques de codigo markdown) con esta forma exacta:

{
  "convocatoria": "nombre corto de la convocatoria",
  "tipo": "uno de: osc, empresa, emprendimiento_operacion, emprendimiento_idea, persona_fisica, academia, comunidad_indigena",
  "ambito": "Nacional, Internacional, o el nombre de un estado/region",
  "ods": "los ODS relacionados, ejemplo: 'ODS 1, ODS 8'",
  "descripcion": "resumen de 2-3 oraciones de en que consiste",
  "requisitos": "requisitos principales para aplicar, en una lista separada por punto y coma",
  "monto": "monto o apoyo que ofrece, como texto (ejemplo: '$50,000 MXN' o 'Mentoria y acceso a inversionistas')",
  "fecha_limite": "fecha limite en formato YYYY-MM-DD si se encuentra, o cadena vacia si no aparece",
  "estatus": "Abierta si no hay indicacion de que ya cerro, Cerrada si el texto dice que ya paso la fecha limite",
  "criterios": {
    "alcance_geo": "Nacional, Internacional, Estatal, o null",
    "estado": "nombre exacto de un estado de Mexico si aplica solo a uno, o null",
    "ods_num": [numeros de ODS mencionados, ejemplo: [1, 8]]
  }
}

Si algun dato no aparece en el texto, usa una cadena vacia "" (o null en criterios). No inventes datos que no esten en el texto. No agregues campos adicionales.`;

function extractJsonObject(text: string): Record<string, unknown> | null {
  const sinFences = text.replace(/```json/gi, '').replace(/```/g, '');
  const inicio = sinFences.indexOf('{');
  const fin = sinFences.lastIndexOf('}');
  if (inicio === -1 || fin === -1 || fin < inicio) return null;
  try {
    return JSON.parse(sinFences.slice(inicio, fin + 1));
  } catch {
    return null;
  }
}

async function tryGemini(
  userMessage: string,
  diagnostics: Diagnostic[]
): Promise<Record<string, unknown> | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    diagnostics.push({ provider: 'gemini', status: 'omitido', error: 'GEMINI_API_KEY no configurada' });
    return null;
  }
  const modelo = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${SYSTEM_PROMPT}\n\n---\n\n${userMessage}` }] }],
        }),
      }
    );
    if (!resp.ok) {
      diagnostics.push({ provider: 'gemini', status: 'error', error: `HTTP ${resp.status}` });
      return null;
    }
    const data = await resp.json();
    const texto = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const objeto = extractJsonObject(texto);
    if (!objeto) {
      diagnostics.push({ provider: 'gemini', status: 'error', error: 'Respuesta sin JSON valido' });
      return null;
    }
    diagnostics.push({ provider: 'gemini', status: 'ok' });
    return objeto;
  } catch (err) {
    diagnostics.push({ provider: 'gemini', status: 'error', error: String(err) });
    return null;
  }
}

async function tryOpenAICompatible(
  nombre: string,
  endpointEnv: string,
  modelEnv: string,
  keyEnv: string,
  endpointDefault: string,
  modelDefault: string,
  userMessage: string,
  diagnostics: Diagnostic[]
): Promise<Record<string, unknown> | null> {
  const apiKey = process.env[keyEnv];
  if (!apiKey) {
    diagnostics.push({ provider: nombre, status: 'omitido', error: `${keyEnv} no configurada` });
    return null;
  }
  const endpoint = process.env[endpointEnv] || endpointDefault;
  const modelo = process.env[modelEnv] || modelDefault;
  try {
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelo,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
      }),
    });
    if (!resp.ok) {
      diagnostics.push({ provider: nombre, status: 'error', error: `HTTP ${resp.status}` });
      return null;
    }
    const data = await resp.json();
    const texto = data?.choices?.[0]?.message?.content || '';
    const objeto = extractJsonObject(texto);
    if (!objeto) {
      diagnostics.push({ provider: nombre, status: 'error', error: 'Respuesta sin JSON valido' });
      return null;
    }
    diagnostics.push({ provider: nombre, status: 'ok' });
    return objeto;
  } catch (err) {
    diagnostics.push({ provider: nombre, status: 'error', error: String(err) });
    return null;
  }
}

function limpiarHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 12000);
}

export async function POST(req: NextRequest) {
  const guard = await requireRole(req, 'admin');
  if (guard instanceof NextResponse) return guard;

  const diagnostics: Diagnostic[] = [];

  try {
    const body = await req.json();
    const url = String(body?.url || '').trim();
    if (!url || !/^https?:\/\//i.test(url)) {
      return NextResponse.json({ error: 'Da una URL valida (debe empezar con http:// o https://).' }, { status: 400 });
    }

    let textoPagina = '';
    try {
      const pagina = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MBE-Copilot-Extractor/1.0)' },
      });
      if (!pagina.ok) {
        return NextResponse.json(
          { error: `No se pudo abrir esa URL (respuesta ${pagina.status}). Verifica que sea correcta y publica.` },
          { status: 400 }
        );
      }
      const html = await pagina.text();
      textoPagina = limpiarHtml(html);
    } catch (err) {
      return NextResponse.json(
        { error: 'No se pudo descargar el contenido de esa URL. Verifica que sea correcta y este disponible.' },
        { status: 400 }
      );
    }

    if (!textoPagina) {
      return NextResponse.json({ error: 'La pagina no tiene texto legible para extraer.' }, { status: 400 });
    }

    const userMessage = `URL de la convocatoria: ${url}\n\nTexto de la pagina:\n${textoPagina}`;

    let resultado = await tryGemini(userMessage, diagnostics);

    if (!resultado) {
      resultado = await tryOpenAICompatible(
        'groq',
        'FALLBACK_ENDPOINT',
        'FALLBACK_MODEL',
        'FALLBACK_API_KEY',
        'https://api.groq.com/openai/v1/chat/completions',
        'openai/gpt-oss-120b',
        userMessage,
        diagnostics
      );
    }

    if (!resultado) {
      resultado = await tryOpenAICompatible(
        'openrouter',
        'TERTIARY_ENDPOINT',
        'TERTIARY_MODEL',
        'TERTIARY_API_KEY',
        'https://openrouter.ai/api/v1/chat/completions',
        'openai/gpt-oss-20b:free',
        userMessage,
        diagnostics
      );
    }

    if (!resultado) {
      resultado = await tryOpenAICompatible(
        'deepseek',
        'DEEPSEEK_ENDPOINT',
        'DEEPSEEK_MODEL',
        'DEEPSEEK_API_KEY',
        'https://api.deepseek.com/chat/completions',
        'deepseek-chat',
        userMessage,
        diagnostics
      );
    }

    if (!resultado) {
      return NextResponse.json(
        {
          error: 'Ningun proveedor de IA pudo extraer los datos de esa URL. Puedes llenar el formulario a mano.',
          diagnostics,
        },
        { status: 502 }
      );
    }

    resultado.liga = url;
    return NextResponse.json({ datos: resultado });
  } catch (err) {
    console.error('[admin/convocatorias/extraer] POST error', err);
    return NextResponse.json({ error: 'Ocurrio un error al extraer los datos.', diagnostics }, { status: 500 });
  }
}

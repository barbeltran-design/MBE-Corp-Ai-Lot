import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { requireAuth } from '@/lib/server-roles';
import { DATOS_CONVOCATORIAS } from '@/lib/convocatorias-data';
import { intentarRecargaIA, generarPedidoId } from '@/lib/ia-recarga';

// ---------------------------------------------------------------------------
// POST /api/babel/sugerir-convocatorias  (requiere autenticacion)
//
// Cuando el usuario ya aprobo la Fase 1 de Babel (proposito, cuyo punto 1.2
// es la "Vinculacion con los ODS y Fondos"), esta ruta:
//   1. Lee el resumen aprobado de la Fase 1 desde sessions/babel_{uid}.
//   2. Pide a la IA los fondos/convocatorias mencionados ahi (mismos
//      proveedores de respaldo que las otras rutas de Babel).
//   3. Valida cada una contra lo que YA existe: catalogo estatico de la hoja,
//      convocatorias_extra (publicadas) y convocatorias_ocultas. Lo duplicado
//      se descarta.
//   4. A las nuevas valida su liga con una peticion real; si la liga responde
//      error (o no hay liga) se marcan 'error_liga' para su busqueda manual,
//      y si responde bien quedan 'pendiente' de aprobacion.
//   5. Guarda todo en convocatorias_sugeridas para que un administrador las
//      publique o descarte desde /admin > Convocatorias > Sugerencias.
//
// Ids deterministas (nombre normalizado): si dos usuarios sugieren lo mismo,
// el documento se reutiliza (vecesSugerida++, sugeridaPara arrayUnion) en vez
// de duplicarse. Un fingerprint del resumen evita volver a gastar tokens de IA
// cuando el plan no ha cambiado.
// ---------------------------------------------------------------------------

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/' + GEMINI_MODEL + ':generateContent';

const FALLBACK_ENDPOINT = process.env.FALLBACK_ENDPOINT || 'https://api.groq.com/openai/v1/chat/completions';
const FALLBACK_MODEL = process.env.FALLBACK_MODEL || 'openai/gpt-oss-120b';

const TERTIARY_ENDPOINT = process.env.TERTIARY_ENDPOINT || 'https://openrouter.ai/api/v1/chat/completions';
const TERTIARY_MODEL = process.env.TERTIARY_MODEL || 'openai/gpt-oss-20b:free';

const DEEPSEEK_ENDPOINT = process.env.DEEPSEEK_ENDPOINT || 'https://api.deepseek.com/chat/completions';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

function norm(s: string): string {
  return (s || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function fingerprint(texto: string): string {
  let h = 5381;
  for (let i = 0; i < texto.length; i++) {
    h = ((h << 5) + h + texto.charCodeAt(i)) | 0;
  }
  return 'fp_' + (h >>> 0).toString(36);
}

interface SugerenciaIA {
  tipo?: string;
  nombre?: string;
  requisito?: string;
  url?: string;
}

const SYSTEM_PROMPT =
  'Eres Babel, arquitecto estrategico de negocios. El usuario te da el resumen aprobado de la Fase 1 de su diagnostico estrategico, ' +
  'que incluye la seccion "Vinculacion con los ODS y Fondos". Tu tarea: extraer UNICAMENTE los fondos, programas y convocatorias de ' +
  'financiamiento mencionados ahi (ignora los ODS como tales). Para cada uno devuelve:\n' +
  '{"tipo":"internacional o nacional","nombre":"nombre del fondo o programa, maximo 120 caracteres",' +
  '"requisito":"requisito o enfoque clave, maximo 200 caracteres","url":"liga oficial si la conoces CON CERTEZA; cadena vacia si no"}\n' +
  'Reglas: NUNCA inventes URLs; si no estas seguro de la liga oficial exacta, deja "url" vacia. Responde SOLO con un arreglo JSON puro ' +
  '(sin markdown ni texto extra) de 3 a 10 elementos.';

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

type Diag = { provider: string; status: string; detail?: string };

async function pedirSugerenciasIA(resumen: string, diagnostics: Diag[]): Promise<SugerenciaIA[] | null> {
  const userMessage = 'Resumen aprobado de la Fase 1:\n\n' + resumen.slice(0, 12000);

  async function viaGemini(reintento = false): Promise<unknown[] | null> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;
    try {
      const res = await fetch(GEMINI_ENDPOINT + '?key=' + apiKey, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: 'user', parts: [{ text: userMessage }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
        }),
      });
      if (!res.ok && (res.status === 429 || res.status === 402) && !reintento) {
        const rec = await intentarRecargaIA('gemini', generarPedidoId());
        if (rec.recargada) return viaGemini(true);
      }
      const data = await res.json().catch(() => null);
      const text =
        data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p?.text || '').join('') || '';
      const parsed = extractJsonArray(text);
      diagnostics.push({ provider: 'gemini', status: Array.isArray(parsed) ? 'ok' : 'not_array' });
      return Array.isArray(parsed) ? parsed : null;
    } catch (err) {
      diagnostics.push({ provider: 'gemini', status: 'error', detail: String(err).slice(0, 160) });
      return null;
    }
  }

  async function viaOpenAICompatible(
    endpoint: string,
    model: string,
    apiKey: string | undefined,
    label: string
  ): Promise<unknown[] | null> {
    if (!apiKey) return null;
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userMessage },
          ],
          temperature: 0.3,
          max_tokens: 4096,
        }),
      });
      const data = await res.json().catch(() => null);
      const text = data?.choices?.[0]?.message?.content || '';
      const parsed = extractJsonArray(text);
      diagnostics.push({ provider: label, status: Array.isArray(parsed) ? 'ok' : 'not_array' });
      return Array.isArray(parsed) ? parsed : null;
    } catch (err) {
      diagnostics.push({ provider: label, status: 'error', detail: String(err).slice(0, 160) });
      return null;
    }
  }

  let result = await viaGemini();
  if (!result)
    result = await viaOpenAICompatible(FALLBACK_ENDPOINT, FALLBACK_MODEL, process.env.FALLBACK_API_KEY, 'groq');
  if (!result)
    result = await viaOpenAICompatible(TERTIARY_ENDPOINT, TERTIARY_MODEL, process.env.TERTIARY_API_KEY, 'openrouter');
  if (!result)
    result = await viaOpenAICompatible(DEEPSEEK_ENDPOINT, DEEPSEEK_MODEL, process.env.DEEPSEEK_API_KEY, 'deepseek');

  return result && result.length ? (result as SugerenciaIA[]) : null;
}

async function ligaResponde(url: string): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 7000);
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MBE-Corpilot/1.0; validador-de-ligas)' },
    });
    clearTimeout(t);
    return res.status < 400;
  } catch {
    return false;
  }
}

function ligaDeBusqueda(nombre: string): string {
  return (
    'https://www.google.com/search?q=' +
    encodeURIComponent('convocatoria fondo "' + nombre + '"')
  );
}

export async function POST(req: NextRequest) {
  let uid: string;
  try {
    uid = await requireAuth(req);
  } catch {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }

  try {
    const db = getAdminDb();

    // 1. Resumen aprobado de la Fase 1 (proposito).
    const sessSnap = await db.collection('sessions').doc(`babel_${uid}`).get();
    if (!sessSnap.exists) {
      return NextResponse.json({ ok: true, estado: 'sin_plan', evaluadas: 0, nuevas: 0, errorLiga: 0 });
    }
    const fases = (sessSnap.data()?.phases ?? []) as Array<{
      phase?: number;
      approved?: boolean;
      summary?: string;
    }>;
    const registro1 = [...fases]
      .filter((p) => Number(p?.phase) === 1 && typeof p?.summary === 'string')
      .sort((a, b) => (b?.approved ? 1 : 0) - (a?.approved ? 1 : 0))[0];
    const resumen = String(registro1?.summary || '').trim();
    if (!resumen) {
      return NextResponse.json({ ok: true, estado: 'sin_plan', evaluadas: 0, nuevas: 0, errorLiga: 0 });
    }

    const fp = fingerprint(resumen);

    // 2. Cache: si alguna sugerencia ya lleva este fingerprint, el plan no ha
    // cambiado desde la ultima vez; no gastamos tokens de nuevo.
    const cacheSnap = await db
      .collection('convocatorias_sugeridas')
      .where('fingerprints', 'array-contains', fp)
      .limit(1)
      .get();
    if (!cacheSnap.empty) {
      const totalSnap = await db.collection('convocatorias_sugeridas').count().get();
      return NextResponse.json({
        ok: true,
        estado: 'cache',
        evaluadas: 0,
        nuevas: 0,
        errorLiga: 0,
        totalPendientes: totalSnap.data().count,
      });
    }

    // 3. Extraccion con IA.
    const diagnostics: Diag[] = [];
    const crudas = await pedirSugerenciasIA(resumen, diagnostics);
    if (!crudas) {
      return NextResponse.json(
        { ok: false, error: 'No se pudieron generar sugerencias.', diagnostics },
        { status: 502 }
      );
    }

    // 4. Duplicados contra todo lo existente.
    const nombresExistentes = new Set<string>();
    for (const c of DATOS_CONVOCATORIAS) nombresExistentes.add(norm(c.convocatoria));
    const [extraSnap, ocultasSnap] = await Promise.all([
      db.collection('convocatorias_extra').get(),
      db.collection('convocatorias_ocultas').get(),
    ]);
    extraSnap.docs.forEach((d) => nombresExistentes.add(norm(String(d.data().convocatoria || ''))));
    ocultasSnap.docs.forEach((d) => nombresExistentes.add(d.id));

    const ahora = new Date().toISOString();
    let evaluadas = 0;
    let nuevas = 0;
    let errorLiga = 0;

    for (const raw of crudas.slice(0, 10)) {
      const nombre = String(raw?.nombre || '').trim();
      if (!nombre) continue;
      const idNorm = norm(nombre);
      if (!idNorm || nombresExistentes.has(idNorm)) continue;
      nombresExistentes.add(idNorm); // dedupe intra-batch tambien
      evaluadas++;

      let liga = String(raw?.url || '').trim();
      if (liga && !/^https?:\/\//i.test(liga)) liga = '';
      const ligaOk = liga ? await ligaResponde(liga) : false;
      const estado = ligaOk ? 'pendiente' : 'error_liga';
      if (estado === 'error_liga') errorLiga++;
      nuevas++;

      const ref = db.collection('convocatorias_sugeridas').doc(idNorm);
      const yaExistia = (await ref.get()).exists;
      if (yaExistia) {
        // Otro usuario ya la habia sugerido: solo sumamos participacion.
        await ref.update({
          vecesSugerida: FieldValue.increment(1),
          ultimaVez: ahora,
          fingerprints: FieldValue.arrayUnion(fp),
          sugeridaPara: FieldValue.arrayUnion(uid),
          // Si antes tenia liga rota y ahora la IA trajo una buena, se mejora.
          ...(ligaOk && estado === 'pendiente' ? { liga, fuenteUrl: liga, estado } : {}),
        });
      } else {
        await ref.set({
          nombre,
          tipo: String(raw?.tipo || '').trim() === 'internacional' ? 'internacional' : 'nacional',
          requisito: String(raw?.requisito || '').trim(),
          liga: ligaOk ? liga : '',
          fuenteUrl: liga || '',
          ligaBusqueda: ligaDeBusqueda(nombre),
          estado,
          fuente: 'babel_fase1',
          fingerprints: [fp],
          vecesSugerida: 1,
          sugeridaEn: ahora,
          ultimaVez: ahora,
          sugeridaPara: [uid],
        });
      }
    }

    return NextResponse.json({ ok: true, estado: 'nuevo', evaluadas, nuevas, errorLiga, diagnostics });
  } catch (err) {
    console.error('[babel/sugerir-convocatorias] error', err);
    return NextResponse.json({ error: 'No se pudieron procesar las sugerencias.' }, { status: 500 });
  }
}

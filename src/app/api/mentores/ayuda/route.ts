import { NextRequest, NextResponse } from 'next/server';
import { buildMentorSystemPrompt, callMentorLLM, esMentorValido, MentorChatMessage } from '@/lib/mentores';

// ---------------------------------------------------------------------------
// POST /api/mentores/ayuda
//
// Modo tip: el mentor da un tip breve y accionable sobre UNA accion puntual
//           del Plan de Accion (sin busqueda web).
// Modo chat: conversacion abierta con el mentor, acotada SOLO al texto de esa
//            accion (nunca al resto del plan). Busca en internet como
//            implementarla y cierra con referencias breves cuando el
//            proveedor lo permite (Gemini). Si el usuario pregunta de otra
//            area, el mentor lo redirige al mentor correcto en vez de
//            responder el.
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const language = body.language === 'en' ? 'en' : 'es';
    const modo = body.modo === 'chat' ? 'chat' : 'tip';
    const mentor = esMentorValido(body.mentor) ? body.mentor : 'Babel';

    const accionRaw = body && typeof body === 'object' ? (body as { accion?: unknown }).accion : undefined;
    const accionObj = accionRaw && typeof accionRaw === 'object' ? (accionRaw as Record<string, unknown>) : {};
    const accion = {
      descripcion: typeof accionObj.descripcion === 'string' ? accionObj.descripcion.trim() : '',
      entregable: typeof accionObj.entregable === 'string' ? accionObj.entregable.trim() : '',
    };

    if (!accion.descripcion) {
      return NextResponse.json(
        { error: language === 'en' ? 'Missing action description.' : 'Falta la descripcion de la accion.' },
        { status: 400 },
      );
    }

    const mensajesEntrada: MentorChatMessage[] = Array.isArray(body.mensajes)
      ? (body.mensajes as unknown[])
          .filter((m): m is { role?: string; content: string } => {
            return !!m && typeof m === 'object' && typeof (m as { content?: unknown }).content === 'string';
          })
          .slice(-10)
          .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }))
      : [];

    const systemPrompt = buildMentorSystemPrompt(mentor, language, modo, accion);

    const mensajes: MentorChatMessage[] =
      modo === 'tip'
        ? [{ role: 'user', content: language === 'en' ? 'Give me the tip.' : 'Dame el tip.' }]
        : mensajesEntrada.length > 0
          ? mensajesEntrada
          : [
              {
                role: 'user',
                content: language === 'en' ? 'How do I implement this action?' : 'Como implemento esta accion?',
              },
            ];

    const resultado = await callMentorLLM(systemPrompt, mensajes, modo === 'chat');
    if (!resultado) {
      return NextResponse.json(
        { error: language === 'en' ? 'No AI provider responded. Try again in a moment.' : 'Ningun proveedor de IA respondio. Intenta de nuevo en un momento.' },
        { status: 502 },
      );
    }

    return NextResponse.json({ reply: resultado.reply, mentor, usedSearch: resultado.usedSearch });
  } catch (err) {
    console.error('[mentores/ayuda] error:', err);
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 });
  }
}

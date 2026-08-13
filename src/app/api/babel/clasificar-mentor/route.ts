import { NextRequest, NextResponse } from 'next/server';
import { callMentorLLM, esMentorValido, matchMentorPorTexto, mentorPorPerspectiva, MentorId } from '@/lib/mentores';

// ---------------------------------------------------------------------------
// POST /api/babel/clasificar-mentor
//
// Identifica que mentor de IA (Babel, Karmetin, Normau, Fisnando, Atech)
// es el mas adecuado para atender una accion del Plan de Accion, sea que
// venga sugerida por IA o que el usuario la haya escrito manualmente.
//
// 1) Intenta primero el catalogo de src/lib/buenas-practicas.ts (fuente de
//    verdad de las areas por accion).
// 2) Si la accion no coincide con nada del catalogo, y se conoce la
//    perspectiva del Balanced Scorecard del objetivo, asigna el mentor por
//    perspectiva (Financieros->Fisnando, Clientes->Karmetin,
//    Procesos->Atech, Aprendizaje->Babel, Socioambientales->Normau).
// 3) Si tampoco hay perspectiva conocida, clasifica por contexto con una
//    sola llamada corta a la IA.
// 4) Si todo falla, regresa 'Babel' como respaldo seguro.
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const descripcion = typeof body.descripcion === 'string' ? body.descripcion.trim() : '';
    const perspectiva = typeof body.perspectiva === 'string' ? body.perspectiva.trim() : '';
    const language = body.language === 'en' ? 'en' : 'es';

    if (!descripcion) {
      return NextResponse.json({ mentor: 'Babel', origen: 'vacio' });
    }

    const porCatalogo = matchMentorPorTexto(descripcion);
    if (porCatalogo) {
      return NextResponse.json({ mentor: porCatalogo, origen: 'catalogo' });
    }

    const porPerspectiva = mentorPorPerspectiva(perspectiva);
    if (porPerspectiva) {
      return NextResponse.json({ mentor: porPerspectiva, origen: 'perspectiva' });
    }

    const prompt =
      language === 'en'
        ? `Read this business action and answer with EXACTLY ONE WORD and nothing else: which of these 5 mentors best fits it? Babel (Strategy/People/Culture), Karmetin (Marketing/Sales/Customer care), Normau (Compliance/Partnerships/ESG), Fisnando (Finance/Tax), Atech (Operations/Knowledge/Digital). Action: "${descripcion}"`
        : `Lee esta accion de negocio y responde con EXACTAMENTE UNA PALABRA y nada mas: cual de estos 5 mentores le queda mejor? Babel (Rumbo Estrategico/Capital Humano/Cultura), Karmetin (Marketing/Ventas/Atencion a clientes), Normau (Cumplimiento Normativo/Alianzas/ESG), Fisnando (Finanzas/Fiscal), Atech (Operacion/Conocimiento/Digitalizacion). Accion: "${descripcion}"`;

    const resultado = await callMentorLLM(prompt, [{ role: 'user', content: descripcion }], false);
    const crudo = (resultado?.reply || '').trim();
    const primeraPalabra = crudo.split(/\s+/)[0] || '';
    const limpio = primeraPalabra.replace(/[^a-zA-Z]/g, '');
    const candidato = limpio.charAt(0).toUpperCase() + limpio.slice(1).toLowerCase();
    const mentor: MentorId = esMentorValido(candidato) ? candidato : 'Babel';

    return NextResponse.json({ mentor, origen: resultado ? 'ia' : 'fallback' });
  } catch (err) {
    console.error('[clasificar-mentor] error:', err);
    return NextResponse.json({ mentor: 'Babel', origen: 'error' });
  }
}

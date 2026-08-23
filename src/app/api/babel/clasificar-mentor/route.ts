import { NextRequest, NextResponse } from 'next/server';
import { mentorPorPerspectiva } from '@/lib/mentores';

// ---------------------------------------------------------------------------
// POST /api/babel/clasificar-mentor
//
// Identifica que mentor de IA (Babel, Karmetin, Normau, Fisnando, Atech, Ecori)
// es el mas adecuado para atender una accion del Plan de Accion, sea que
// venga sugerida por IA o que el usuario la haya escrito manualmente.
//
// El mentor de cada accion se determina UNICAMENTE por la perspectiva del
// Balanced Scorecard del objetivo al que pertenece (ver PERSPECTIVAS en
// src/lib/plan-accion.ts): Financieros->Fisnando, Clientes->Karmetin,
// Procesos->Atech, Aprendizaje->Babel, Socioambientales->Ecori.
// Si la accion pertenece a un objetivo sin perspectiva conocida, se usa
// 'Babel' como respaldo seguro. Ya no se usa el catalogo de buenas
// practicas ni clasificacion por IA para determinar el mentor.
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const descripcion = typeof body.descripcion === 'string' ? body.descripcion.trim() : '';
    const perspectiva = typeof body.perspectiva === 'string' ? body.perspectiva.trim() : '';

    if (!descripcion) {
      return NextResponse.json({ mentor: 'Babel', origen: 'vacio' });
    }

        const porPerspectiva = mentorPorPerspectiva(perspectiva);
    if (porPerspectiva) {
      return NextResponse.json({ mentor: porPerspectiva, origen: 'perspectiva' });
    }

    return NextResponse.json({ mentor: 'Babel', origen: 'sin_perspectiva' });
  } catch (err) {
    console.error('[clasificar-mentor] error:', err);
    return NextResponse.json({ mentor: 'Babel', origen: 'error' });
  }
}

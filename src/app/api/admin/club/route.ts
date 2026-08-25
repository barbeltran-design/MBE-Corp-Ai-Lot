import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { requireAdminSeccion } from '@/lib/server-roles';
import {
  CATALOGO_PUNTOS,
  NIVEL_PUNTOS,
  ACCESOS_COMUNIDAD,
  type PuntoCatalogoItem,
  type NivelClubItem,
} from '@/lib/club';

// ---------------------------------------------------------------------------
// GET  /api/admin/club — valores vigentes del catalogo de puntos y de los
//                        niveles de la comunidad (config de Firestore con
//                        fallback a las constantes).
// PUT  /api/admin/club — guarda {tipo:'catalogo'|'niveles', items:[...]}.
//
// Los valores viven en docs config/catalogo_puntos y config/niveles_club; el
// Club los lee con fallback a CATALOGO_PUNTOS / NIVEL_PUNTOS, asi que borrar
// el documento regresa el comportamiento por defecto.
// ---------------------------------------------------------------------------
const CATALOGO_PUNTOS_DOC = 'config/catalogo_puntos';
const NIVELES_CLUB_DOC = 'config/niveles_club';

export async function GET(req: NextRequest) {
  const guard = await requireAdminSeccion(req, 'club');
  if (guard instanceof NextResponse) return guard;

  try {
    const db = getAdminDb();
    const [catSnap, nivSnap] = await Promise.all([
      db.doc(CATALOGO_PUNTOS_DOC).get(),
      db.doc(NIVELES_CLUB_DOC).get(),
    ]);
    const catItems = catSnap.exists ? (catSnap.data() as { items?: unknown }).items : null;
    const nivItems = nivSnap.exists ? (nivSnap.data() as { items?: unknown }).items : null;

    const catalogo: PuntoCatalogoItem[] =
      Array.isArray(catItems) && catItems.length
        ? (catItems as Record<string, unknown>[]).map((c) => ({
            id: String(c.id ?? ''),
            es: String(c.es ?? ''),
            en: String(c.en ?? ''),
            valor: Number(c.valor) || 0,
          }))
        : CATALOGO_PUNTOS.map((c) => ({ ...c }));

    const niveles: NivelClubItem[] =
      Array.isArray(nivItems) && nivItems.length
        ? (nivItems as Record<string, unknown>[]).map((n) => ({
            id: String(n.id ?? ''),
            umbral: Number(n.umbral) || 0,
            es: String(n.es ?? ''),
            en: String(n.en ?? ''),
            accesos: Array.isArray(n.accesos) ? (n.accesos as unknown[]).map(String) : [],
          }))
        : NIVEL_PUNTOS.map((n) => ({ ...n, accesos: [] as string[] }));

    return NextResponse.json({
      catalogo,
      niveles,
      accesosPosibles: ACCESOS_COMUNIDAD.map((a) => ({ ...a })),
      personalizado: { catalogo: Array.isArray(catItems) && catItems.length > 0, niveles: Array.isArray(nivItems) && nivItems.length > 0 },
    });
  } catch (err) {
    console.error('[admin/club] GET error', err);
    return NextResponse.json({ error: 'No se pudo leer la configuración del Club.' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const guard = await requireAdminSeccion(req, 'club');
  if (guard instanceof NextResponse) return guard;

  try {
    const body = (await req.json()) as { tipo?: string; items?: unknown[] };
    const tipo = String(body?.tipo ?? '');
    const itemsRaw = Array.isArray(body?.items) ? body.items : [];

    if (tipo === 'catalogo') {
      const items: PuntoCatalogoItem[] = [];
      for (const raw of itemsRaw) {
        const c = raw as Record<string, unknown>;
        const id = String(c.id ?? '').trim();
        if (!id) continue;
        items.push({
          id,
          es: String(c.es ?? '').trim(),
          en: String(c.en ?? '').trim() || String(c.es ?? '').trim(),
          valor: Math.round(Number(c.valor) || 0),
        });
      }
      if (items.length === 0) {
        return NextResponse.json({ error: 'El catálogo necesita al menos una categoría con id.' }, { status: 400 });
      }
      await getAdminDb()
        .doc(CATALOGO_PUNTOS_DOC)
        .set({ items, actualizadoEn: new Date().toISOString(), actualizadoPor: guard.uid });
      return NextResponse.json({ ok: true });
    }

    if (tipo === 'niveles') {
      const idsAcceso = new Set(ACCESOS_COMUNIDAD.map((a) => a.id as string));
      const items: NivelClubItem[] = [];
      for (const raw of itemsRaw) {
        const n = raw as Record<string, unknown>;
        const id = String(n.id ?? '').trim();
        if (!id) continue;
        items.push({
          id,
          umbral: Math.max(0, Math.round(Number(n.umbral) || 0)),
          es: String(n.es ?? '').trim(),
          en: String(n.en ?? '').trim() || String(n.es ?? '').trim(),
          accesos: Array.isArray(n.accesos)
            ? (n.accesos as unknown[]).map(String).filter((a) => idsAcceso.has(a))
            : [],
        });
      }
      if (items.length === 0) {
        return NextResponse.json({ error: 'Se necesita al menos un nivel con id.' }, { status: 400 });
      }
      // Los niveles deben quedar en orden ascendente por umbral.
      items.sort((a, b) => a.umbral - b.umbral);
      await getAdminDb()
        .doc(NIVELES_CLUB_DOC)
        .set({ items, actualizadoEn: new Date().toISOString(), actualizadoPor: guard.uid });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'tipo inválido (usa catalogo o niveles).' }, { status: 400 });
  } catch (err) {
    console.error('[admin/club] PUT error', err);
    return NextResponse.json({ error: 'No se pudo guardar la configuración del Club.' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

// GET /api/babel/convocatorias-extra — endpoint PUBLICO (sin auth) que usa
// ConvocatoriasBuilder.tsx para complementar el catalogo estatico
// (src/lib/convocatorias-data.json, que viene de la hoja de Google) con:
//   - publicadas: convocatorias que un administrador agrego a mano desde
//     /admin (por URL) y ya publico (coleccion convocatorias_extra).
//   - ocultas: nombres normalizados de convocatorias del catalogo estatico
//     que un administrador decidio ocultar de la pagina publica
//     (coleccion convocatorias_ocultas).
// No modifica ni depende de src/lib/convocatorias-data.json.
export async function GET() {
  try {
    const db = getAdminDb();
    const [extraSnap, ocultasSnap] = await Promise.all([
      db.collection('convocatorias_extra').orderBy('creadaEn', 'desc').get(),
      db.collection('convocatorias_ocultas').get(),
    ]);
    const publicadas = extraSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const ocultas = ocultasSnap.docs.map((d) => d.id);
    return NextResponse.json({ publicadas, ocultas });
  } catch (err) {
    // Nunca romper la pagina publica de Convocatorias: si algo falla del
    // lado de Firestore, se comporta igual que si no hubiera datos extra.
    console.error('[babel/convocatorias-extra] GET error', err);
    return NextResponse.json({ publicadas: [], ocultas: [] });
  }
}

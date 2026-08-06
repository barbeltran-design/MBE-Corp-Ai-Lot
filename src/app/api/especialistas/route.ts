import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { requireAuth } from '@/lib/server-roles';
import { TEMAS_ESPECIALISTA, TEMA_LABELS } from '@/lib/roles';

// GET /api/especialistas — lista pública (usuarios autenticados) de
// especialistas con agenda configurada, para agendar reuniones por tema.
export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
  } catch (err) {
    if ((err as Error).message === 'NO_AUTH') {
      return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
    }
    throw err;
  }

  try {
    const db = getAdminDb();
    const usersSnap = await db.collection('users').limit(500).get();
    const especialistas: {
      uid: string;
      nombre: string;
      email: string;
      temas: { id: string; label: string }[];
      agenda: { plataforma: string; link: string; usuario: string } | null;
    }[] = [];

    for (const docSnap of usersSnap.docs) {
      const data = docSnap.data() as Record<string, unknown>;
      const roles = Array.isArray(data.roles) ? (data.roles as unknown[]).map(String) : [];
      if (!roles.includes('especialista')) continue;
      const temasRaw = Array.isArray(data.especialistaTemas)
        ? (data.especialistaTemas as unknown[]).map(String)
        : [];
      const temas = temasRaw
        .filter((t) => (TEMAS_ESPECIALISTA as readonly string[]).includes(t))
        .map((t) => ({ id: t, label: TEMA_LABELS[t as keyof typeof TEMA_LABELS].es }));
      const agenda = data.agenda as { plataforma?: string; link?: string; usuario?: string } | null;
      const link = agenda?.link ?? '';
      const usuarioCal = agenda?.usuario ?? '';
      if (!link && !usuarioCal) continue; // solo con agenda configurada
      especialistas.push({
        uid: docSnap.id,
        nombre: (data.name as string) ?? '',
        email: (data.email as string) ?? '',
        temas,
        agenda: {
          plataforma: agenda?.plataforma === 'google' ? 'google' : 'calendly',
          link,
          usuario: usuarioCal,
        },
      });
    }

    return NextResponse.json({ especialistas });
  } catch (err) {
    console.error('[especialistas] GET error', err);
    return NextResponse.json({ error: 'No se pudieron leer los especialistas.' }, { status: 500 });
  }
}
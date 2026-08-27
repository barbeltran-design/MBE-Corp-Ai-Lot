// GET/PUT de las preferencias de notificación del usuario logueado
// (notificationPreferences/{uid}). Ver src/lib/notificaciones.ts para cómo
// se consumen estas preferencias al enviar notificaciones.
//
// Encabezado requerido: Authorization: Bearer <token de Firebase>

import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import type { NotificationPreferencesDoc, NotificacionCategoria } from '@/types/firestore';

const CATEGORIAS_VALIDAS: NotificacionCategoria[] = [
  'juntaClub',
  'reunionB2B',
  'referenciaAplicada',
  'retoSemanal',
  'actividadesVencen',
  'nuevaConvocatoria',
  'misionesPendientes',
  'ranking',
  'mentorReunionAgendada',
];

const DEFAULTS: Omit<NotificationPreferencesDoc, 'uid'> = {
  canales: { email: true, sms: false, whatsapp: false },
  digestSemanal: true,
  categoriasActivas: Object.fromEntries(CATEGORIAS_VALIDAS.map((c) => [c, true])) as Record<
    NotificacionCategoria,
    boolean
  >,
};

async function usuarioAutenticado(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization') || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return null;
  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    return decoded.uid;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const uid = await usuarioAutenticado(req);
  if (!uid) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }

  const db = getAdminDb();
  const snap = await db.collection('notificationPreferences').doc(uid).get();
  if (!snap.exists) {
    return NextResponse.json({ uid, ...DEFAULTS });
  }
  const data = snap.data() as Partial<NotificationPreferencesDoc>;
  return NextResponse.json({
    uid,
    canales: {
      email: data.canales?.email ?? true,
      sms: data.canales?.sms ?? false,
      whatsapp: data.canales?.whatsapp ?? false,
    },
    telefonoWhatsapp: data.telefonoWhatsapp,
    digestSemanal: data.digestSemanal ?? true,
    categoriasActivas: { ...DEFAULTS.categoriasActivas, ...(data.categoriasActivas ?? {}) },
    horaPreferida: data.horaPreferida,
    updatedAt: data.updatedAt,
  });
}

export async function PUT(req: NextRequest) {
  const uid = await usuarioAutenticado(req);
  if (!uid) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }

  let body: Partial<NotificationPreferencesDoc>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo JSON inválido.' }, { status: 400 });
  }

  // Solo se aceptan los campos conocidos, para no permitir que el cliente
  // escriba propiedades arbitrarias en el documento.
  const canales = {
    email: typeof body.canales?.email === 'boolean' ? body.canales.email : true,
    sms: typeof body.canales?.sms === 'boolean' ? body.canales.sms : false,
    whatsapp: typeof body.canales?.whatsapp === 'boolean' ? body.canales.whatsapp : false,
  };

  const categoriasActivas: Record<NotificacionCategoria, boolean> = { ...DEFAULTS.categoriasActivas };
  if (body.categoriasActivas && typeof body.categoriasActivas === 'object') {
    for (const cat of CATEGORIAS_VALIDAS) {
      const v = body.categoriasActivas[cat];
      if (typeof v === 'boolean') categoriasActivas[cat] = v;
    }
  }

  const doc: NotificationPreferencesDoc = {
    uid,
    canales,
    telefonoWhatsapp: typeof body.telefonoWhatsapp === 'string' ? body.telefonoWhatsapp : undefined,
    digestSemanal: typeof body.digestSemanal === 'boolean' ? body.digestSemanal : true,
    categoriasActivas,
    horaPreferida: typeof body.horaPreferida === 'string' ? body.horaPreferida : undefined,
    updatedAt: new Date().toISOString(),
  };

  const db = getAdminDb();
  await db.collection('notificationPreferences').doc(uid).set(doc, { merge: true });

  return NextResponse.json({ ok: true, preferencias: doc });
}

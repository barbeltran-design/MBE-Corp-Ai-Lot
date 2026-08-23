import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase-admin';
import { getAdminDb } from '@/lib/firebase-admin';
import { esAdmin, esEspecialista, esRepSale, type AppRole, type SeccionAdmin } from '@/lib/roles';

// Verifica el token de Firebase en el header Authorization y devuelve el uid,
// o lanza throw si no autenticado.
export async function requireAuth(req: NextRequest): Promise<string> {
  const authHeader = req.headers.get('authorization') || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) {
    throw new Error('NO_AUTH');
  }
  const decoded = await getAdminAuth().verifyIdToken(idToken);
  return decoded.uid;
}

// Lee los roles actuales del usuario desde Firestore users/{uid}.
export async function readUserRoles(uid: string): Promise<string[]> {
  const db = getAdminDb();
  const snap = await db.collection('users').doc(uid).get();
  if (!snap.exists) return [];
  const data = snap.data() || {};
  const roles = data.roles;
  return Array.isArray(roles) ? roles.map((r: unknown) => String(r)) : [];
}

// Verifica que el usuario tenga el rol indicado. Devuelve NextResponse 401/403
// en caso de que no.
export async function requireRole(
  req: NextRequest,
  role: AppRole | 'admin' | 'especialista' | 'rep_sale'
): Promise<{ uid: string; roles: string[] } | NextResponse> {
  try {
    const uid = await requireAuth(req);
    const roles = await readUserRoles(uid);
    const ok =
      role === 'admin'
        ? esAdmin(roles)
        : role === 'especialista'
          ? esEspecialista(roles)
          : role === 'rep_sale'
            ? esRepSale(roles)
            : true;
    if (!ok) {
      return NextResponse.json({ error: 'No tienes permisos para esta acción.' }, { status: 403 });
    }
    return { uid, roles };
  } catch (err) {
    if ((err as Error).message === 'NO_AUTH') {
      return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
    }
    throw err;
  }
}

// Lee las secciones de administracion del usuario (users/{uid}.adminSecciones).
export async function readAdminSecciones(uid: string): Promise<string[]> {
  const db = getAdminDb();
  const snap = await db.collection('users').doc(uid).get();
  if (!snap.exists) return [];
  const data = snap.data() || {};
  const secciones = data.adminSecciones;
  return Array.isArray(secciones) ? secciones.map((s: unknown) => String(s)) : [];
}

// Como requireRole(req, 'admin') pero tambien acepta a un "admin de seccion":
// un usuario sin el rol general 'admin' que tiene users/{uid}.adminSecciones
// incluyendo la seccion pedida. Un admin general siempre pasa.
export async function requireAdminSeccion(
  req: NextRequest,
  seccion: SeccionAdmin
): Promise<{ uid: string; roles: string[]; adminSecciones: string[] } | NextResponse> {
  try {
    const uid = await requireAuth(req);
    const [roles, adminSecciones] = await Promise.all([readUserRoles(uid), readAdminSecciones(uid)]);
    const ok =
      esAdmin(roles) ||
      (Array.isArray(adminSecciones) && (adminSecciones as string[]).includes(seccion));
    if (!ok) {
      return NextResponse.json({ error: 'No tienes permisos para esta acción.' }, { status: 403 });
    }
    return { uid, roles, adminSecciones };
  } catch (err) {
    if ((err as Error).message === 'NO_AUTH') {
      return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
    }
    throw err;
  }
}
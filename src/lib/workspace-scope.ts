'use client';

import * as React from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { getFirebaseAuth, getFirebaseDb } from '@/lib/firebase';

// ─────────────────────────────────────────────────────────────────────────
// Helper compartido para aislar por cuenta (uid) los datos que los
// builders de Babel guardan en localStorage.
//
// Antes de este helper, varios builders usaban claves GLOBALES fijas
// (ej. 'babel_plan_accion_v2') sin ningun namespacing por usuario. Como
// localStorage es compartido por NAVEGADOR (no por cuenta), si en el mismo
// navegador se usaban varias cuentas, los objetivos/datos de una cuenta se
// filtraban a la siguiente. Este helper corrige eso:
//
// 1. scopedKey(): calcula una clave exclusiva de la cuenta actual. Nunca
//    devuelve la clave "pelona" (sin sufijo) para que ese cajon compartido
//    quede retirado para siempre.
// 2. useAuthUidState(): hook reutilizable para saber el uid actual y si
//    Firebase Auth ya resolvio su estado inicial (ready).
// 3. hydrateWorkspaceKey(): la primera vez que se usa una clave con scope
//    de cuenta en un dispositivo, si esta vacia localmente, la rellena
//    con el respaldo que WorkspaceSyncer ya subio a Firestore
//    (users/{uid}/workspace/{seccion}), para que los datos reales del
//    usuario lo sigan a otro dispositivo/navegador en vez de perderse.
// ─────────────────────────────────────────────────────────────────────────

export function scopedKey(base: string, uid: string | null): string {
  return uid ? `${base}::u:${uid}` : `${base}::anon`;
}

export function useAuthUidState(): { uid: string | null; ready: boolean } {
  const [uid, setUid] = React.useState<string | null>(null);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUid(u?.uid ?? null);
      setReady(true);
    });
    return unsubscribe;
  }, []);

  return { uid, ready };
}

export async function hydrateWorkspaceKey(
  uid: string | null,
  seccion: string,
  storageKey: string
): Promise<void> {
  if (!uid || typeof window === 'undefined') return;
  const key = scopedKey(storageKey, uid);
  try {
    const existing = window.localStorage.getItem(key);
    if (existing) return; // no pisar datos locales ya presentes en este dispositivo
  } catch {
    return;
  }
  try {
    const db = getFirebaseDb();
    const snap = await getDoc(doc(db, 'users', uid, 'workspace', seccion));
    if (snap.exists()) {
      const data = snap.data() as { data?: unknown };
      if (data && typeof data.data === 'string') {
        window.localStorage.setItem(key, data.data);
      }
    }
  } catch (err) {
    console.error(`[workspace-scope] hydrate ${seccion}`, err);
  }
}

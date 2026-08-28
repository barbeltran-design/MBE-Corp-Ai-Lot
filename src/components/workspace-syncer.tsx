'use client';

import * as React from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { getFirebaseAuth, getFirebaseDb } from '@/lib/firebase';
import { scopedKey } from '@/lib/workspace-scope';

// ─────────────────────────────────────────────────────────────────────────
// Sincroniza el contenido de las secciones del workspace (que los builders
// guardan en localStorage) hacia Firestore: users/{uid}/workspace/{seccion}
// = { data, updatedAt }. Esto permite que administración y especialistas
// vean qué ha puesto cada usuario en cada sección.
// ─────────────────────────────────────────────────────────────────────────

interface WorkspaceEntry {
  seccion: string;
  key: string;
}

const SECTIONS: WorkspaceEntry[] = [
  { seccion: 'plan-accion', key: 'babel_plan_accion_v2' },
  { seccion: 'contactos', key: 'babel_plan_accion_contactos_v1' },
  { seccion: 'indicadores', key: 'babel_indicadores_v1' },
  { seccion: 'organigrama', key: 'babel_orgchart_v1' },
  { seccion: 'junta-directiva', key: 'babel_orgchart_board_v1' },
  { seccion: 'madurez-plan', key: 'babel_madurez_plan_v1' },
  { seccion: 'finanzas', key: 'babel_financial_goals_v1' },
  { seccion: 'finanzas-historial', key: 'babel_financial_goals_history_v1' },
];

const SYNC_INTERVAL_MS = 4000;
const WORKSPACE_SYNC_EVENT = 'mbe:workspace-sync';

// Evento que los builders pueden disparar para forzar el sync inmediato.
export function requestWorkspaceSync() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(WORKSPACE_SYNC_EVENT));
  }
}

export function WorkspaceSyncer() {
  const lastRef = React.useRef<Record<string, string>>({});

  const syncOnce = React.useCallback(async (uid: string) => {
    const db = getFirebaseDb();
    const writes: Promise<unknown>[] = [];
    for (const { seccion, key } of SECTIONS) {
      const scoped = scopedKey(key, uid);
      let raw: string | null = null;
      try {
        raw = window.localStorage.getItem(scoped);
      } catch {
        continue;
      }
      if (!raw) continue;
      const last = lastRef.current[scoped];
      if (last === raw) continue;
      lastRef.current[scoped] = raw;
      writes.push(
        setDoc(
          doc(db, 'users', uid, 'workspace', seccion),
          { data: raw, updatedAt: new Date().toISOString() },
          { merge: true }
        ).catch((err) => console.error(`[workspace-sync] ${key}`, err))
      );
    }
    if (writes.length) {
      await Promise.all(writes);
    }
  }, []);

  React.useEffect(() => {
    let uidRef: string | null = null;
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      uidRef = u?.uid ?? null;
      if (uidRef) {
        syncOnce(uidRef).catch(() => {});
      }
    });

    const interval = window.setInterval(() => {
      if (uidRef) syncOnce(uidRef).catch(() => {});
    }, SYNC_INTERVAL_MS);

    const onEvent = () => {
      if (uidRef) syncOnce(uidRef).catch(() => {});
    };
    window.addEventListener(WORKSPACE_SYNC_EVENT, onEvent);
    window.addEventListener('storage', onEvent);

    return () => {
      unsubscribe();
      window.clearInterval(interval);
      window.removeEventListener(WORKSPACE_SYNC_EVENT, onEvent);
      window.removeEventListener('storage', onEvent);
    };
  }, [syncOnce]);

  return null;
}
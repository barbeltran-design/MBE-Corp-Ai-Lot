'use client';

import * as React from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { getFirebaseAuth, getFirebaseDb } from '@/lib/firebase';
import { esAdmin, esEspecialista, esRepSale } from '@/lib/roles';

export interface UserRolesState {
  loading: boolean;
  user: User | null;
  roles: string[];
  specialistTemas: string[];
  especialista: boolean;
  administracion: boolean;
  repSale: boolean;
}

export const DEFAULT_ROLES_STATE: UserRolesState = {
  loading: true,
  user: null,
  roles: [],
  specialistTemas: [],
  especialista: false,
  administracion: false,
  repSale: false,
};

// Lee los roles y temas del usuario logueado desde users/{uid}.roles y
// users/{uid}.especialistaTemas. Un usuario sin roles en Firestore se trata
// como 'usuario' normal (sin permisos elevados).
export function useUserRoles(): UserRolesState {
  const [state, setState] = React.useState<UserRolesState>(DEFAULT_ROLES_STATE);

  React.useEffect(() => {
    const auth = getFirebaseAuth();
    const db = getFirebaseDb();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setState({ ...DEFAULT_ROLES_STATE, loading: false });
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        const data = snap.exists() ? snap.data() : {};
        const roles: string[] = Array.isArray(data.roles)
          ? (data.roles as unknown[]).map(String)
          : [];
        const specialistTemas: string[] = Array.isArray(data.especialistaTemas)
          ? (data.especialistaTemas as unknown[]).map(String)
          : [];
        setState({
          loading: false,
          user,
          roles,
          specialistTemas,
          especialista: esEspecialista(roles),
          administracion: esAdmin(roles),
          repSale: esRepSale(roles),
        });
      } catch {
        setState({
          loading: false,
          user,
          roles: [],
          specialistTemas: [],
          especialista: false,
          administracion: false,
          repSale: false,
        });
      }
    });
    return unsubscribe;
  }, []);

  return state;
}
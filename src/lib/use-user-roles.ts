'use client';

import * as React from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { getFirebaseAuth, getFirebaseDb } from '@/lib/firebase';
import {
  esAdmin,
  esEspecialista,
  esRepSale,
  tieneAlgunaSeccionAdmin,
  type SeccionAdmin,
} from '@/lib/roles';

export interface UserRolesState {
  loading: boolean;
  user: User | null;
  roles: string[];
  specialistTemas: string[];
  adminSecciones: string[];
  especialista: boolean;
  /** true si es admin general O tiene al menos una seccion asignada. */
  administracion: boolean;
  /** true solo para admin general (rol 'admin'). */
  adminGeneral: boolean;
  repSale: boolean;
}

export const DEFAULT_ROLES_STATE: UserRolesState = {
  loading: true,
  user: null,
  roles: [],
  specialistTemas: [],
  adminSecciones: [],
  especialista: false,
  administracion: false,
  adminGeneral: false,
  repSale: false,
};

// Lee los roles y temas del usuario logueado desde users/{uid}.roles y
// users/{uid}.especialistaTemas. Un usuario sin roles en Firestore se trata
// como 'usuario' normal (sin permisos elevados). Tambien lee
// users/{uid}.adminSecciones (administracion por pestaña del panel).
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
        const adminSecciones: string[] = Array.isArray(data.adminSecciones)
          ? (data.adminSecciones as unknown[]).map(String)
          : [];
        setState({
          loading: false,
          user,
          roles,
          specialistTemas,
          adminSecciones,
          especialista: esEspecialista(roles),
          administracion: esAdmin(roles) || tieneAlgunaSeccionAdmin(adminSecciones),
          adminGeneral: esAdmin(roles),
          repSale: esRepSale(roles),
        });
      } catch {
        setState({
          loading: false,
          user,
          roles: [],
          specialistTemas: [],
          adminSecciones: [],
          especialista: false,
          administracion: false,
          adminGeneral: false,
          repSale: false,
        });
      }
    });
    return unsubscribe;
  }, []);

  return state;
}

// ¿Puede este estado de roles administrar la seccion indicada del panel?
export function puedeAdministrarSeccion(
  state: Pick<UserRolesState, 'roles' | 'adminSecciones'>,
  seccion: SeccionAdmin
): boolean {
  if (esAdmin(state.roles)) return true;
  return Array.isArray(state.adminSecciones) && state.adminSecciones.includes(seccion);
}
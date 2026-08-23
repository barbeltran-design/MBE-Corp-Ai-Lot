'use client';

import * as React from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { getFirebaseAuth, getFirebaseDb } from '@/lib/firebase';
import { BABEL_IMPLEMENTED_PHASES } from '@/lib/babel-constants';

// ---------------------------------------------------------------------------
// Estado del plan estrategico (sesion de Babel) para pantallas fuera del chat,
// con reactividad en vivo: si el usuario reinicia su plan (resetBabelSession
// sobreescribe el documento), el snapshot dispara y este hook se actualiza
// solo — sin recargar la pagina.
//
// - fasePropositoAprobada: existe un registro aprobado de la Fase 1
//   ("ADN Estrategico y Proposito"), donde vive el punto 1.2 de alineacion
//   con ODS y convocatorias.
// - ods: numeros de ODS (1-17) detectados en el resumen aprobado de esa fase.
//     Se buscan menciones tipo "ODS 8" / "SDG 8" (con : - # opcionales).
// ---------------------------------------------------------------------------

export interface PlanEstrategicoState {
  cargando: boolean;
  user: User | null;
  /** Hay registro aprobado de la Fase 1 (proposito, punto 1.2 incluido). */
  fasePropositoAprobada: boolean;
  /** Todas las fases implementadas (0..4) estan aprobadas. */
  planCompleto: boolean;
  fasesAprobadas: number;
  totalFases: number;
  /** ODS detectados en el resumen aprobado de la Fase 1. */
  ods: number[];
}

export const PLAN_ESTRATEGICO_VACIO: PlanEstrategicoState = {
  cargando: true,
  user: null,
  fasePropositoAprobada: false,
  planCompleto: false,
  fasesAprobadas: 0,
  totalFases: BABEL_IMPLEMENTED_PHASES,
  ods: [],
};

interface PhaseRecordLite {
  phase?: number;
  approved?: boolean;
  summary?: string;
}

export function extraerOdsDeResumen(summary: string): number[] {
  if (!summary) return [];
  const encontrados = new Set<number>();
  const re = /\b(?:ODS|SDG)\s*[:\-#]?\s*(\d{1,2})/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(summary))) {
    const n = Number(m[1]);
    if (Number.isInteger(n) && n >= 1 && n <= 17) encontrados.add(n);
  }
  return Array.from(encontrados).sort((a, b) => a - b);
}

function estadoDesdeSession(data: Record<string, unknown> | undefined): Pick<
  PlanEstrategicoState,
  'fasePropositoAprobada' | 'planCompleto' | 'fasesAprobadas' | 'ods'
> {
  const fases: PhaseRecordLite[] = Array.isArray(data?.phases)
    ? (data?.phases as PhaseRecordLite[])
    : [];
  const aprobadasUnicas = new Set(
    fases.filter((p) => p && p.approved).map((p) => Number(p.phase))
  );
  const propositoOk = aprobadasUnicas.has(1);
  let ods: number[] = [];
  const registro1 = [...fases]
    .filter((p) => p && Number(p.phase) === 1 && typeof p.summary === 'string')
    .sort((a, b) => (b?.approved ? 1 : 0) - (a?.approved ? 1 : 0))[0];
  if (registro1?.summary) ods = extraerOdsDeResumen(registro1.summary);

  return {
    fasePropositoAprobada: propositoOk,
    planCompleto:
      BABEL_IMPLEMENTED_PHASES > 0 &&
      Array.from({ length: BABEL_IMPLEMENTED_PHASES }, (_, i) => i).every((i) =>
        aprobadasUnicas.has(i)
      ),
    fasesAprobadas: aprobadasUnicas.size,
    ods,
  };
}

export function usePlanEstrategico(): PlanEstrategicoState {
  const [state, setState] = React.useState<PlanEstrategicoState>(PLAN_ESTRATEGICO_VACIO);

  React.useEffect(() => {
    const auth = getFirebaseAuth();
    const db = getFirebaseDb();
    let unsubSnap: (() => void) | null = null;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (unsubSnap) {
        unsubSnap();
        unsubSnap = null;
      }
      if (!user) {
        setState({ ...PLAN_ESTRATEGICO_VACIO, cargando: false, user: null });
        return;
      }
      setState((prev) => ({ ...prev, cargando: true, user }));
      // Listener en vivo sobre sessions/babel_{uid}: se actualiza cuando el
      // usuario aprueba una fase Y tambien cuando reinicia su plan.
      unsubSnap = onSnapshot(
        doc(db, 'sessions', `babel_${user.uid}`),
        (snap) => {
          const data = snap.exists() ? (snap.data() as Record<string, unknown>) : undefined;
          setState({
            cargando: false,
            user,
            totalFases: BABEL_IMPLEMENTED_PHASES,
            ...estadoDesdeSession(data),
          });
        },
        () => {
          // Permisos u error de red: dejamos el estado vacio sin romper la UI.
          setState({ ...PLAN_ESTRATEGICO_VACIO, cargando: false, user });
        }
      );
    });
    return () => {
      if (unsubSnap) unsubSnap();
      unsubscribe();
    };
  }, []);

  return state;
}

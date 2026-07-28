'use client';

// ─────────────────────────────────────────────────────────────────────────
// ESTE ARCHIVO VA EN: src/app/dashboard/page.tsx
// (o app/dashboard/page.tsx si tu proyecto no usa carpeta "src").
//
// ⚠️ ANTES DE SUBIRLO: si ya tienes algo funcionando en /dashboard,
// avísame primero — este archivo lo reemplazaría por completo.
//
// Qué es: primera versión del dashboard — estado del plan + botón de pago.
// Todavía NO incluye progreso de fases ni entregables generados (eso es
// el resto de la Task #51) — para eso necesito ver primero cómo están
// estructuradas tus colecciones "assessments" y "sessions" en Firestore,
// que aún no me has mostrado. Prefiero decírtelo claro a inventar campos
// que no sé si existen.
// ─────────────────────────────────────────────────────────────────────────

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { getFirebaseAuth, getFirebaseDb } from '@/lib/firebase';

type UserDoc = {
  subscription?: string;
  planStatus?: string;
  name?: string;
  email?: string;
};

type SessionDoc = {
  currentPhase?: number;
  agentId?: string;
};

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pagoParam = searchParams.get('pago'); // 'exitoso' | 'fallido' | 'pendiente' | null

  const [user, setUser] = useState<User | null>(null);
  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);
  const [sessionDoc, setSessionDoc] = useState<SessionDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getFirebaseAuth(), async (firebaseUser) => {
      if (!firebaseUser) {
        // Ajusta esta ruta si tu página de inicio de sesión no es "/".
        router.push('/');
        return;
      }
      setUser(firebaseUser);

      const snap = await getDoc(doc(getFirebaseDb(), 'users', firebaseUser.uid));
      setUserDoc(snap.exists() ? (snap.data() as UserDoc) : null);

      // El id del documento de sesión de Babel es "babel_" + uid, no el uid solo.
      const sessionSnap = await getDoc(
        doc(getFirebaseDb(), 'sessions', `babel_${firebaseUser.uid}`)
      );
      setSessionDoc(sessionSnap.exists() ? (sessionSnap.data() as SessionDoc) : null);

      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  async function handlePagar() {
    if (!user) return;
    setPayLoading(true);
    setPayError(null);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/pagos/crear-preferencia', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json();
      if (!res.ok || !data.checkoutUrl) {
        throw new Error(data.error || 'No se pudo iniciar el pago.');
      }
      window.location.href = data.checkoutUrl;
    } catch (err) {
      console.error(err);
      setPayError('No se pudo iniciar el pago. Intenta de nuevo en unos segundos.');
      setPayLoading(false);
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Cargando tu panel…</div>;
  }

  const esPro = userDoc?.subscription === 'pro' && userDoc?.planStatus === 'active';

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">
        Hola{userDoc?.name ? `, ${userDoc.name}` : ''}
      </h1>

      {pagoParam === 'exitoso' && (
        <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-green-800">
          Tu pago se está confirmando. En unos segundos verás tu plan activado aquí abajo.
        </div>
      )}
      {pagoParam === 'pendiente' && (
        <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4 text-yellow-800">
          Tu pago quedó pendiente de confirmación por Mercado Pago.
        </div>
      )}
      {pagoParam === 'fallido' && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-800">
          El pago no se completó. Puedes intentarlo de nuevo cuando quieras.
        </div>
      )}

      {sessionDoc?.currentPhase !== undefined && (
        <div className="rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-medium mb-2">Tu progreso</h2>
          <p className="text-gray-700">
            Fase actual: <span className="font-semibold">{sessionDoc.currentPhase}</span>
          </p>
          {/* Entregables por fase: pendiente — falta ver la subcolección
              "entries" dentro de assessments/{'{uid}'} para saber qué campos
              mostrar aquí sin inventar nada. */}
        </div>
      )}

      <div className="rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-medium mb-2">Tu plan</h2>
        {esPro ? (
          <p className="text-green-700 font-medium">Plan completo activo.</p>
        ) : (
          <>
            <p className="text-gray-600 mb-4">
              Estás en el diagnóstico gratuito. Desbloquea el plan completo para
              acceder a todas las herramientas.
            </p>
            <button
              onClick={handlePagar}
              disabled={payLoading}
              className="rounded-md bg-blue-600 text-white px-5 py-2.5 font-medium disabled:opacity-50"
            >
              {payLoading ? 'Abriendo Mercado Pago…' : 'Pagar plan completo'}
            </button>
            {payError && <p className="text-red-600 text-sm mt-2">{payError}</p>}
          </>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">Cargando…</div>}>
      <DashboardContent />
    </Suspense>
  );
}

'use client';
import * as React from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';

// ---------------------------------------------------------------------------
// Tarjeta "Presupuesto de datos de tus agentes" (Ecori). Muestra el estado de
// la inteligencia de los agentes: topes, ultimo estado por proveedor y las
// recargas agenticas recientes con su enlace al block explorer. Leida siempre
// a traves de la ruta proxy autenticada (el cliente nunca toca Circle).
// ---------------------------------------------------------------------------

interface RecargaItem {
  proveedor?: string;
  montoUsd?: number;
  txId?: string;
  explorerUrl?: string;
  creadoEn?: unknown;
}

interface ProveedorItem {
  proveedor: string;
  ultimoEstatus?: string;
  ultimoTxId?: string;
  examenUrl?: string;
}

interface EstadoAPI {
  config?: { topePorTransaccionUsd?: number; topeDiarioUsd?: number; servicio?: string };
  proveedores?: ProveedorItem[];
  recientes?: RecargaItem[];
}

const ETIQUETAS: Record<string, { es: string; en: string }> = {
  gemini: { es: 'Gemini', en: 'Gemini' },
  groq: { es: 'Groq', en: 'Groq' },
  openrouter: { es: 'OpenRouter', en: 'OpenRouter' },
  deepseek: { es: 'DeepSeek', en: 'DeepSeek' },
};

export default function EcoriDataBudget({ lang = 'es' as 'es' | 'en' }) {
  const [estado, setEstado] = React.useState<EstadoAPI | null>(null);
  const [cargando, setCargando] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, async (usr) => {
      if (!usr) {
        setCargando(false);
        return;
      }
      try {
        const idToken = await usr.getIdToken();
        const res = await fetch('/api/agents/ecori/recarga', {
          headers: { Authorization: 'Bearer ' + idToken },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Error');
        setEstado(data as EstadoAPI);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error');
      } finally {
        setCargando(false);
      }
    });
    return () => unsub();
  }, []);

  const t = (label: { es: string; en: string }) => (lang === 'en' ? label.en : label.es);

  return (
    <div className="glass-panel rounded-2xl border border-glass-border bg-glass p-5 shadow-sm">
      <h3 className="mb-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
        {lang === 'en' ? 'Your agents data budget (Ecori)' : 'Presupuesto de datos de tus agentes (Ecori)'}
      </h3>
      <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
        {lang === 'en'
          ? 'When the AI models run out of tokens, Ecori pays the recharge automatically within the daily cap.'
          : 'Cuando los modelos de IA se quedan sin tokens, Ecori paga la recarga en automático dentro del tope diario.'}
      </p>

      {cargando && <p className="text-xs text-slate-400">{lang === 'en' ? 'Loading...' : 'Cargando...'}</p>}
      {error && <p className="text-xs text-red-600">Error: {error}</p>}

      {estado && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 text-[11px] text-slate-600 dark:text-slate-300">
            <span className="rounded-full bg-teal-50 px-2 py-0.5 dark:bg-teal-900/40">
              {lang === 'en' ? 'Per transaction cap' : 'Tope por transacción'}: ${estado.config?.topePorTransaccionUsd?.toFixed(2) ?? '1.00'} USD
            </span>
            <span className="rounded-full bg-teal-50 px-2 py-0.5 dark:bg-teal-900/40">
              {lang === 'en' ? 'Daily cap' : 'Tope diario'}: ${estado.config?.topeDiarioUsd?.toFixed(2) ?? '5.00'} USD
            </span>
            <span className={'rounded-full px-2 py-0.5 ' + (estado.config?.servicio === 'configurado' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300')}>
              {estado.config?.servicio === 'configurado'
                ? (lang === 'en' ? 'Ecori service: active' : 'Servicio de Ecori: activo')
                : (lang === 'en' ? 'Ecori service: not configured' : 'Servicio de Ecori: no configurado')}
            </span>
          </div>

          {estado.proveedores && estado.proveedores.length > 0 && (
            <div>
              <p className="mb-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {lang === 'en' ? 'Model providers' : 'Proveedores de modelos'}
              </p>
              <ul className="space-y-1">
                {estado.proveedores.map((p) => (
                  <li key={p.proveedor} className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-200">
                    <span>{t(ETIQUETAS[p.proveedor] ?? { es: p.proveedor, en: p.proveedor })}</span>
                    <span className="text-emerald-600 dark:text-emerald-400">{p.ultimoEstatus === 'recargado' ? (lang === 'en' ? 'recharged' : 'recargado') : p.ultimoEstatus ?? '—'}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {estado.recientes && estado.recientes.length > 0 && (
            <div>
              <p className="mb-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {lang === 'en' ? 'Recent agent recharges' : 'Recargas agenticas recientes'}
              </p>
              <ul className="space-y-1">
                {estado.recientes.slice(0, 5).map((r, i) => (
                  <li key={i + '-' + (r.txId ?? '')} className="flex items-center justify-between gap-2 text-xs text-slate-700 dark:text-slate-200">
                    <span>{t(ETIQUETAS[r.proveedor ?? ''] ?? { es: r.proveedor ?? '', en: r.proveedor ?? ''})} · ${(r.montoUsd ?? 0).toFixed(2)} USD</span>
                    {r.explorerUrl ? (
                      <a href={r.explorerUrl} target="_blank" rel="noreferrer" className="text-teal-600 underline-offset-2 hover:underline dark:text-teal-400">
                        {lang === 'en' ? 'View on explorer' : 'Ver en explorer'}
                      </a>
                    ) : (
                      <span className="text-slate-400">{r.txId?.slice(0, 10) ?? '—'}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(!estado.recientes || estado.recientes.length === 0) && (
            <p className="text-[11px] text-slate-400">
              {lang === 'en' ? 'No agent recharge recorded yet. It will appear here when Ecori pays.' : 'Aún no hay recargas agenticas. Aparecerán aquí cuando Ecori pague.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
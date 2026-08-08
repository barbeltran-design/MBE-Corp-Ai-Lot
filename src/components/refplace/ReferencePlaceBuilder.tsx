'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';
import { useDisplayLang } from '@/components/display-lang-provider';
import {
  BadgeCheck,
  CalendarClock,
  Check,
  Handshake,
  Loader2,
  LogIn,
  Medal,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Send,
  Store,
  Target,
  Users,
  X,
} from 'lucide-react';
import {
  NIVELES_COMUNIDAD,
  nivelLabel,
  TIPOS_REUNION,
  TIPOS_RESULTADO,
  montoRequerido,
  type MiembroComunidad,
  type SolicitudReferencia,
  type OfertaRepSale,
  type ReunionB2B,
  type TipoReunion,
  type TipoResultado,
} from '@/lib/refplace';

interface YoComunidad {
  uid: string;
  nombre: string;
  email: string;
  telefono: string;
  nivel: string;
  certificado: boolean;
  rolRepSale: boolean;
  puedeB2B: boolean;
  puedeReferencias: boolean;
}

interface PerfilPublico {
  perfil: {
    uid: string;
    nombre: string;
    email: string;
    telefono: string;
    empresa: string;
    giro: string;
    pais: string;
    nivel: { id: string; es: string; en: string };
    certificado: boolean;
    rolRepSale: boolean;
    madurez: {
      totalScore: number | null;
      nivelGlobal: string | null;
      areas: unknown | null;
      fecha: string;
    } | null;
    reunionesCompletadas: number;
    montoResultados: number;
    resultados: { tipo: string; monto: number; descripcion: string; createdAt: string }[];
  };
}

interface ResumenDatos {
  yo: YoComunidad;
  miembros: MiembroComunidad[];
  solicitudes: SolicitudReferencia[];
  ofertas: OfertaRepSale[];
  reuniones: ReunionB2B[];
}

type TabId = 'mercado' | 'reuniones' | 'comunidad';

const NIVEL_LABEL_GLOBAL: Record<string, [string, string]> = {
  execution: ['Ejecución', 'Execution'],
  standard: ['Estándar', 'Standard'],
  control: ['Control', 'Control'],
  optimization: ['Optimización', 'Optimization'],
  excellence: ['Excelencia', 'Excellence'],
  influencer: ['Influencer', 'Influencer'],
};

function fmtMoneda(v: number): string {
  return '$' + v.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function nivelGlobalLabel(level: string, lang: 'es' | 'en'): string {
  const m = NIVEL_LABEL_GLOBAL[level];
  return m ? (lang === 'en' ? m[1] : m[0]) : level;
}

const ESTATUS_LABEL: Record<string, [string, string]> = {
  propuesta: ['Propuesta', 'Proposed'],
  aceptada: ['Aceptada', 'Accepted'],
  completada: ['Completada', 'Completed'],
  cancelada: ['Cancelada', 'Cancelled'],
};

function estatusLabel(estatus: string, lang: 'es' | 'en'): string {
  const m = ESTATUS_LABEL[estatus];
  return m ? (lang === 'en' ? m[1] : m[0]) : estatus;
}

export function ReferencePlaceBuilder() {
  const params = useParams();
  const routeLocale = typeof params.locale === 'string' ? params.locale : 'es';
  const { lang } = useDisplayLang();
  const [dispLang, setDispLang] = React.useState<'es' | 'en'>(routeLocale === 'en' ? 'en' : 'es');
  React.useEffect(() => { setDispLang(lang); }, [lang]);
  const t = (es: string, en: string) => (dispLang === 'en' ? en : es);

  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');

  const [yo, setYo] = React.useState<YoComunidad | null>(null);
  const [miembros, setMiembros] = React.useState<MiembroComunidad[]>([]);
  const [solicitudes, setSolicitudes] = React.useState<SolicitudReferencia[]>([]);
  const [ofertas, setOfertas] = React.useState<OfertaRepSale[]>([]);
  const [reuniones, setReuniones] = React.useState<ReunionB2B[]>([]);

  const [tab, setTab] = React.useState<TabId>('mercado');
  const [busqueda, setBusqueda] = React.useState('');

  // Forms solicitud
  const [solEmpresa, setSolEmpresa] = React.useState('');
  const [solDesc, setSolDesc] = React.useState('');
  const [solComision, setSolComision] = React.useState('5');
  const [solRepUid, setSolRepUid] = React.useState('');
  // Forms oferta
  const [ofEmpresa, setOfEmpresa] = React.useState('');
  const [ofRubro, setOfRubro] = React.useState('');
  const [ofDesc, setOfDesc] = React.useState('');
  const [ofComision, setOfComision] = React.useState('5');
  // Forms reunión
  const [reTitulo, setReTitulo] = React.useState('');
  const [reTipo, setReTipo] = React.useState<TipoReunion>('asesoria');
  const [reDesc, setReDesc] = React.useState('');
  const [reParticipantes, setReParticipantes] = React.useState<string[]>([]);
  const [reFechaLbl, setReFechaLbl] = React.useState('');
  // Resultado
  const [resReunion, setResReunion] = React.useState<ReunionB2B | null>(null);
  const [resTipo, setResTipo] = React.useState<TipoResultado>('compra');
  const [resMonto, setResMonto] = React.useState('');
  const [resDesc, setResDesc] = React.useState('');
  // Perfil público
  const [perfilUid, setPerfilUid] = React.useState<string | null>(null);
  const [perfilData, setPerfilData] = React.useState<PerfilPublico['perfil'] | null>(null);
  const [perfilLoading, setPerfilLoading] = React.useState(false);

  async function cargarTodo(token: string): Promise<ResumenDatos> {
    const res = await fetch('/api/refplace', { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error('load failed');
    return res.json();
  }

  function aplicar(data: ResumenDatos) {
    setYo(data.yo);
    setMiembros(data.miembros);
    setSolicitudes(data.solicitudes);
    setOfertas(data.ofertas);
    setReuniones(data.reuniones);
  }

  React.useEffect(() => {
    let cancelled = false;
    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, (usr) => {
      setUser(usr);
      if (!usr) {
        if (!cancelled) setLoading(false);
        return;
      }
      void usr
        .getIdToken()
        .then(async (token) => {
          const data = await cargarTodo(token);
          if (!cancelled) aplicar(data);
        })
        .catch((err) => {
          console.error('[refplace] load failed', err);
          if (!cancelled) setError(t('No se pudo cargar el Reference Place.', 'Could not load the Reference Place.'));
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    });
    return () => { cancelled = true; unsub(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function act(accion: string, body: Record<string, unknown>, okMsg: string) {
    if (!user) {
      setError(t('Inicia sesión para usar el Reference Place.', 'Log in to use the Reference Place.'));
      return;
    }
    setBusy(accion);
    setError('');
    setSuccess('');
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/refplace', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion, ...body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'request failed');
      setSuccess(okMsg);
      const data2 = await cargarTodo(token);
      aplicar(data2);
      // Limpia forms
      setSolEmpresa(''); setSolDesc(''); setSolComision('5'); setSolRepUid('');
      setOfEmpresa(''); setOfRubro(''); setOfDesc(''); setOfComision('5');
      setReTitulo(''); setReTipo('asesoria'); setReDesc(''); setReParticipantes([]); setReFechaLbl('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'error');
    } finally {
      setBusy(null);
    }
  }

  async function recargar() {
    if (!user) return;
    setBusy('recarga');
    setError('');
    setSuccess('');
    try {
      const token = await user.getIdToken();
      aplicar(await cargarTodo(token));
    } catch {
      setError(t('No se pudo actualizar.', 'Could not refresh.'));
    } finally {
      setBusy(null);
    }
  }

  async function abrirPerfil(uid: string) {
    if (!user) return;
    setPerfilUid(uid);
    setPerfilData(null);
    setPerfilLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/refplace/perfil?uid=${encodeURIComponent(uid)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data: PerfilPublico | { error?: string } = await res.json();
      if (!res.ok || !('perfil' in data)) throw new Error('load failed');
      setPerfilData(data.perfil);
    } catch (err) {
      console.error('[refplace] perfil failed', err);
      setPerfilData(null);
    } finally {
      setPerfilLoading(false);
    }
  }

  const esRep = yo?.rolRepSale || false;
  const otrosMiembros = yo ? miembros.filter((m) => m.uid !== yo.uid) : [];
  const repsSales = miembros.filter((m) => m.rolRepSale);

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t('Reference Place', 'Reference Place')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('Mercado de referencias, reuniones B2B y perfiles públicos de la comunidad certificada MBE.', 'Referral marketplace, B2B meetings and public profiles of the certified MBE community.')}
          </p>
        </div>
        <button
          type="button"
          onClick={recargar}
          className="inline-flex items-center gap-2 rounded-lg border border-glass-border bg-glass px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          {busy === 'recarga' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {t('Actualizar', 'Refresh')}
        </button>
      </header>

      {loading && <div className="flex min-h-[30vh] items-center justify-center text-sm text-muted-foreground">{t('Cargando...', 'Loading...')}</div>}

      {!loading && !user && (
        <div className="glass-panel p-10 text-center">
          <LogIn className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">{t('Inicia sesión para ver el Reference Place.', 'Log in to see the Reference Place.')}</p>
        </div>
      )}

      {!loading && user && yo && (
        <>
          {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
          {success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{success}</div>}

          {/* Tarjeta de mi perfil comunitario */}
          <div className="glass-panel p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-600 text-lg font-bold text-white">
                  {yo.nombre.slice(0, 2).toUpperCase() || 'Yo'}
                </div>
                <div>
                  <p className="font-semibold text-foreground">{yo.nombre}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('Nivel:', 'Level:')} <span className="font-semibold text-teal-700 dark:text-teal-300">{nivelLabel(yo.nivel, dispLang)}</span>
                    {yo.certificado && (
                      <span className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                        <BadgeCheck className="h-3 w-3" /> {t('Certificado', 'Certified')}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-glass px-2.5 py-1 text-xs font-medium text-muted-foreground">
                  {t('Reuniones B2B', 'B2B meetings')}: {yo.puedeB2B ? '✓' : '—'}
                </span>
                <span className="rounded-full bg-glass px-2.5 py-1 text-xs font-medium text-muted-foreground">
                  {t('Referencias', 'Referrals')}: {yo.puedeReferencias ? '✓' : '—'}
                </span>
              </div>
            </div>
            <div className="mt-3 grid gap-2 border-t border-glass-border pt-3 text-xs text-muted-foreground sm:grid-cols-2">
              <div className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 shrink-0 text-teal-600" />
                {yo.telefono || t('Agrega tu teléfono en tu perfil para que la comunidad te contacte.', 'Add your phone in your profile so the community can reach you.')}
              </div>
              <div>
                {!yo.puedeReferencias && <span>{t('Referencias: disponible desde Empresario Orquesta.', 'Referrals: available from Orchestra Business Owner.')}</span>}
                {yo.puedeB2B && yo.puedeReferencias && <span>{t('Tienes acceso completo de la comunidad.', 'You have full community access.')}</span>}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap gap-2">
            {([
              ['mercado', 'Referencias y Rep Sales', Store],
              ['reuniones', 'Reuniones B2B', Handshake],
              ['comunidad', 'Comunidad', Users],
            ] as [TabId, string, React.ComponentType<{ className?: string }>][]).map(([id, lbl, Icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={
                  'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ' +
                  (tab === id ? 'bg-teal-600 text-white' : 'bg-glass text-muted-foreground hover:text-foreground')
                }
              >
                <Icon className="h-4 w-4" />
                {t(lbl, lbl)}
              </button>
            ))}
          </div>

          {/* ── MERCADO ─────────────────────────────────────────────────── */}
          {tab === 'mercado' && (
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="space-y-4 lg:col-span-1">
                <div className="glass-panel p-4">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-teal-600" />
                    <h2 className="text-sm font-semibold text-foreground">{t('Solicitar referencia', 'Request a reference')}</h2>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('Pide a la comunidad certificada (o a un Rep Sale) que te consiga una cita con una empresa, a cambio de una comisión al concretar.', 'Ask the certified community (or a Rep Sale) to get you a meeting with a company, for a success fee.')}
                  </p>
                </div>

                {yo.puedeReferencias ? (
                  <div className="glass-panel space-y-3 p-4">
                    <input
                      className="w-full rounded-lg border border-glass-border bg-glass px-3 py-2 text-sm text-foreground"
                      value={solEmpresa}
                      onChange={(e) => setSolEmpresa(e.target.value)}
                      placeholder={t('Empresa objetivo', 'Target company')}
                    />
                    <textarea
                      className="w-full rounded-lg border border-glass-border bg-glass px-3 py-2 text-sm text-foreground"
                      rows={2}
                      value={solDesc}
                      onChange={(e) => setSolDesc(e.target.value)}
                      placeholder={t('¿Qué buscas conseguir?', 'What do you want to achieve?')}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="number"
                        className="rounded-lg border border-glass-border bg-glass px-3 py-2 text-sm text-foreground"
                        value={solComision}
                        onChange={(e) => setSolComision(e.target.value)}
                        placeholder="% comisión"
                      />
                      <select
                        className="rounded-lg border border-glass-border bg-glass px-3 py-2 text-sm text-foreground"
                        value={solRepUid}
                        onChange={(e) => setSolRepUid(e.target.value)}
                      >
                        <option value="">{t('Comunidad (cualquier rep)', 'Any rep in the community')}</option>
                        {repsSales.map((m) => (
                          <option key={m.uid} value={m.uid}>{m.nombre}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={() => act('crear-solicitud', { empresaObjetivo: solEmpresa, descripcion: solDesc, comisionPct: Number(solComision) || 0, repSaleUid: solRepUid || null }, t('Solicitud creada.', 'Request created.'))}
                      disabled={busy === 'crear-solicitud'}
                      className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-700 disabled:opacity-60"
                    >
                      {busy === 'crear-solicitud' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      {t('Publicar solicitud', 'Publish request')}
                    </button>
                  </div>
                ) : (
                  <div className="glass-panel p-4 text-sm text-muted-foreground">
                    {t('Para solicitar referencias necesitas al menos el nivel "Empresario Orquesta" (o ser Rep Sale).', 'To request referrals you need at least the "Orchestra Business Owner" level (or be a Rep Sale).')}
                  </div>
                )}

                {/* Solicitudes abiertas */}
                <div>
                  <h3 className="pb-2 text-sm font-semibold text-foreground">{t('Solicitudes abiertas', 'Open requests')}</h3>
                  <div className="space-y-2">
                    {solicitudes.map((s) => (
                      <div key={s.id} className="glass-panel p-3">
                        <p className="text-sm font-semibold text-foreground">{s.empresaObjetivo}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {s.nombre} · {t('comisión', 'fee')} {s.comisionPct}%
                          {s.repSaleNombre && <> · {s.repSaleNombre}</>}
                        </p>
                        {s.descripcion && <p className="mt-1 text-sm text-muted-foreground">{s.descripcion}</p>}
                        {yo.puedeB2B && s.uid !== yo.uid && (
                          <button
                            type="button"
                            onClick={() => act('crear-reunion', {
                              titulo: t('Apoyo: ' + s.empresaObjetivo, 'Referral: ' + s.empresaObjetivo),
                              tipo: 'referencia',
                              descripcion: t('Referencia de ' + s.empresaObjetivo + ' solicitada por ' + s.nombre, 'Referral for ' + s.empresaObjetivo + ' requested by ' + s.nombre),
                              participantes: [s.uid],
                              fechaPropuesta: new Date().toISOString(),
                            }, t('Se creó una reunión para apoyar esta referencia.', 'A meeting was created to help with this referral.'))}
                            disabled={busy === 'solicitud-apoyo'}
                            className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-teal-600 px-3 py-1.5 text-xs font-medium text-teal-700 transition-colors hover:bg-teal-50 disabled:opacity-60 dark:text-teal-300 dark:hover:bg-teal-500/10"
                          >
                            <Handshake className="h-3.5 w-3.5" />
                            {t('Apoyar con reunión', 'Help with a meeting')}
                          </button>
                        )}
                      </div>
                    ))}
                    {solicitudes.length === 0 && <p className="text-sm text-muted-foreground">{t('No hay solicitudes abiertas.', 'No open requests yet.')}</p>}
                  </div>
                </div>
              </div>

              <div className="space-y-4 lg:col-span-2">
                <div className="glass-panel p-4">
                  <div className="flex items-center gap-2">
                    <Store className="h-4 w-4 text-teal-600" />
                    <h2 className="text-sm font-semibold text-foreground">{t('Rep Sales de la comunidad', 'Community Rep Sales')}</h2>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('Cada Rep Sale ofrece con qué empresas puede referirte. Solicita una reunión B2B para contactarlo.', 'Each Rep Sale lists companies they can refer you to. Request a B2B meeting to get in touch.')}
                  </p>
                </div>

                {esRep && (
                  <div className="glass-panel space-y-3 border-l-4 border-teal-600 p-4">
                    <p className="text-sm font-semibold text-foreground">{t('Publicar tu oferta de referencias', 'Publish your referral offer')}</p>
                    <input
                      className="w-full rounded-lg border border-glass-border bg-glass px-3 py-2 text-sm text-foreground"
                      value={ofEmpresa}
                      onChange={(e) => setOfEmpresa(e.target.value)}
                      placeholder={t('Empresa que puedes referir', 'Company you can refer')}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        className="rounded-lg border border-glass-border bg-glass px-3 py-2 text-sm text-foreground"
                        value={ofRubro}
                        onChange={(e) => setOfRubro(e.target.value)}
                        placeholder={t('Rubro / giro', 'Industry')}
                      />
                      <input
                        type="number"
                        className="rounded-lg border border-glass-border bg-glass px-3 py-2 text-sm text-foreground"
                        value={ofComision}
                        onChange={(e) => setOfComision(e.target.value)}
                        placeholder="% comisión"
                      />
                    </div>
                    <textarea
                      className="w-full rounded-lg border border-glass-border bg-glass px-3 py-2 text-sm text-foreground"
                      rows={2}
                      value={ofDesc}
                      onChange={(e) => setOfDesc(e.target.value)}
                      placeholder={t('¿A quién le conviene?', 'Who is it for?')}
                    />
                    <button
                      type="button"
                      onClick={() => act('crear-oferta', { empresa: ofEmpresa, rubro: ofRubro, descripcion: ofDesc, comisionPct: Number(ofComision) || 0 }, t('Oferta publicada.', 'Offer published.'))}
                      disabled={busy === 'crear-oferta'}
                      className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-700 disabled:opacity-60"
                    >
                      {busy === 'crear-oferta' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      {t('Publicar oferta', 'Publish offer')}
                    </button>
                  </div>
                )}

                <div className="space-y-2">
                  {ofertas.map((o) => (
                    <div key={o.id} className="glass-panel p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground">
                            {o.empresa} {o.rubro && <span className="text-xs font-normal text-muted-foreground">· {o.rubro}</span>}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {o.nombre} {o.comisionPct > 0 && <>· {t('comisión', 'fee')} {o.comisionPct}%</>}
                          </p>
                          {o.descripcion && <p className="mt-1 text-sm text-muted-foreground">{o.descripcion}</p>}
                        </div>
                        {yo.puedeB2B && (
                          <button
                            type="button"
                            onClick={() => act('crear-reunion', {
                              titulo: t('Solicito contacto: ' + o.empresa, 'Contact request: ' + o.empresa),
                              tipo: 'referencia',
                              descripcion: '',
                              participantes: [o.uid],
                              fechaPropuesta: new Date().toISOString(),
                            }, t('Se solicitó la reunión.', 'A meeting was requested.'))}
                            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-teal-700"
                          >
                            <CalendarClock className="h-3.5 w-3.5" />
                            {t('Solicitar cita', 'Request meeting')}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {ofertas.length === 0 && <p className="text-sm text-muted-foreground">{t('No hay ofertas de Rep Sales aún.', 'No Rep Sale offers yet.')}</p>}
                </div>
              </div>
            </div>
          )}

          {/* ── REUNIONES B2B ────────────────────────────────────────────── */}
          {tab === 'reuniones' && (
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="space-y-4">
                <div className="glass-panel p-4">
                  <div className="flex items-center gap-2">
                    <Plus className="h-4 w-4 text-teal-600" />
                    <h2 className="text-sm font-semibold text-foreground">{t('Nueva reunión B2B', 'New B2B meeting')}</h2>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('Comprar entre sí, asesorarse, trueques, alianzas o referencias. Cualquier participante puede registrar el resultado.', 'Buy from each other, advisory, barter, alliances or referrals. Any participant can log the result.')}
                  </p>
                </div>

                {yo.puedeB2B ? (
                  <div className="glass-panel space-y-3 p-4">
                    <input
                      className="w-full rounded-lg border border-glass-border bg-glass px-3 py-2 text-sm text-foreground"
                      value={reTitulo}
                      onChange={(e) => setReTitulo(e.target.value)}
                      placeholder={t('Título', 'Title')}
                    />
                    <select
                      className="w-full rounded-lg border border-glass-border bg-glass px-3 py-2 text-sm text-foreground"
                      value={reTipo}
                      onChange={(e) => setReTipo(e.target.value as TipoReunion)}
                    >
                      {TIPOS_REUNION.map((tp) => <option key={tp.id} value={tp.id}>{dispLang === 'en' ? tp.en : tp.es}</option>)}
                    </select>
                    <textarea
                      className="w-full rounded-lg border border-glass-border bg-glass px-3 py-2 text-sm text-foreground"
                      rows={2}
                      value={reDesc}
                      onChange={(e) => setReDesc(e.target.value)}
                      placeholder={t('¿Qué se busca?', 'What is the goal?')}
                    />
                    <div>
                      <p className="mb-1 text-xs font-medium text-muted-foreground">{t('Participantes (además de ti)', 'Participants (besides you)')}</p>
                      <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-glass-border p-1">
                        {otrosMiembros.map((m) => (
                          <label key={m.uid} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-accent">
                            <input
                              type="checkbox"
                              checked={reParticipantes.includes(m.uid)}
                              onChange={(e) => {
                                setReParticipantes((prev) => (e.target.checked ? [...prev, m.uid] : prev.filter((x) => x !== m.uid)));
                              }}
                              className="rounded border-slate-300 text-teal-600"
                            />
                            <span className="min-w-0 flex-1 truncate text-foreground">{m.nombre}</span>
                            <span className="text-xs text-muted-foreground">{nivelLabel(m.nivel, dispLang)}</span>
                          </label>
                        ))}
                      </div>
                      {otrosMiembros.length === 0 && <p className="mt-1 text-xs text-muted-foreground">{t('No hay otros miembros.', 'No other members.')}</p>}
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-medium text-muted-foreground">{t('Fecha propuesta', 'Proposed date')}</p>
                      <input
                        type="datetime-local"
                        className="w-full rounded-lg border border-glass-border bg-glass px-3 py-2 text-sm text-foreground"
                        value={reFechaLbl}
                        onChange={(e) => setReFechaLbl(e.target.value)}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => act('crear-reunion', { titulo: reTitulo, tipo: reTipo, descripcion: reDesc, participantes: reParticipantes, fechaPropuesta: reFechaLbl ? new Date(reFechaLbl).toISOString() : new Date().toISOString() }, t('Reunión creada.', 'Meeting created.'))}
                      disabled={busy === 'crear-reunion'}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-700 disabled:opacity-60"
                    >
                      {busy === 'crear-reunion' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      {t('Crear reunión B2B', 'Create B2B meeting')}
                    </button>
                  </div>
                ) : (
                  <div className="glass-panel p-4 text-sm text-muted-foreground">
                    {t('Todavía no tienes acceso a esta sección.', 'You do not have access to this section yet.')}
                  </div>
                )}
              </div>

              <div className="space-y-3 lg:col-span-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-foreground">
                    {t('Mis reuniones', 'My meetings')} · {reuniones.filter((r) => r.participantes.some((p) => p.uid === yo.uid)).length}
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    {NIVELES_COMUNIDAD.map((n) => nivelLabel(n.id, dispLang)).join(' · ')}
                  </span>
                </div>
                {reuniones
                  .filter((r) => r.participantes.some((p) => p.uid === yo.uid))
                  .map((r) => (
                    <div key={r.id} className="glass-panel p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-foreground">{r.titulo}</p>
                            <span className="rounded-full bg-teal-600/10 px-2 py-0.5 text-xs font-medium text-teal-700 dark:text-teal-300">
                              {TIPOS_REUNION.find((x) => x.id === r.tipo)?.es || r.tipo}
                            </span>
                            <span className="rounded-full bg-glass px-2 py-0.5 text-xs text-muted-foreground">{estatusLabel(r.estatus, dispLang)}</span>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {t('Creada por', 'Created by')} {r.creadorNombre} · {r.participantes.length} {t('participantes', 'participants')}
                            {r.fechaPropuesta && (
                              <span className="ml-1">· {new Date(r.fechaPropuesta).toLocaleString(dispLang === 'en' ? 'en-US' : 'es-MX')}</span>
                            )}
                          </p>
                          {r.descripcion && <p className="mt-1 text-sm text-muted-foreground">{r.descripcion}</p>}
                          {r.resultados.length > 0 && (
                            <div className="mt-2 rounded-lg border border-glass-border bg-glass p-2 text-xs">
                              <p className="font-medium text-foreground">{t('Resultados', 'Results')}</p>
                              {r.resultados.map((res, i) => (
                                <p key={i} className="mt-1 text-muted-foreground">
                                  {res.nombre}: {TIPOS_RESULTADO.find((x) => x.id === res.tipo)?.es || res.tipo}{' '}
                                  {res.monto > 0 && <span className="font-semibold text-emerald-700 dark:text-emerald-300">{fmtMoneda(res.monto)}</span>}
                                  {res.descripcion && <span> — {res.descripcion}</span>}
                                </p>
                              ))}
                            </div>
                          )}
                          <div className="mt-1 flex flex-wrap gap-1">
                            {r.participantes.map((p) => (
                              <span key={p.uid} className="text-xs text-muted-foreground">· {p.nombre}</span>
                            ))}
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-2">
                          {r.estatus === 'propuesta' && (
                            <button
                              type="button"
                              onClick={() => act('aceptar-reunion', { reunionId: r.id }, t('Reunión aceptada.', 'Meeting accepted.'))}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-teal-700"
                            >
                              <Check className="h-3.5 w-3.5" />
                              {t('Aceptar', 'Accept')}
                            </button>
                          )}
                          {(r.estatus === 'propuesta' || r.estatus === 'aceptada') && (
                            <button
                              type="button"
                              onClick={() => { setResReunion(r); setResMonto(''); setResDesc(''); }}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-teal-600 px-3 py-1.5 text-xs font-medium text-teal-700 transition-colors hover:bg-teal-50 dark:text-teal-300 dark:hover:bg-teal-500/10"
                            >
                              {t('Registrar resultado', 'Log result')}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                {reuniones.filter((r) => r.participantes.some((p) => p.uid === yo.uid)).length === 0 && (
                  <p className="text-sm text-muted-foreground">{t('Aún no participas en reuniones B2B.', 'You are not in any B2B meeting yet.')}</p>
                )}
              </div>
            </div>
          )}

          {/* ── COMUNIDAD ────────────────────────────────────────────────── */}
          {tab === 'comunidad' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <input
                  className="w-full max-w-sm rounded-lg border border-glass-border bg-glass px-3 py-2 text-sm text-foreground"
                  placeholder={t('Buscar por nombre o empresa...', 'Search by name or company...')}
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
                <Search className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {miembros
                  .filter((m) => !busqueda || m.nombre.toLowerCase().includes(busqueda.toLowerCase()) || m.empresa.toLowerCase().includes(busqueda.toLowerCase()))
                  .map((m) => (
                    <button
                      key={m.uid}
                      type="button"
                      onClick={() => abrirPerfil(m.uid)}
                      className="glass-panel p-4 text-left transition-colors hover:bg-accent"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-teal-600 text-sm font-bold text-white">
                          {m.nombre.slice(0, 2).toUpperCase() || '?'}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">{m.nombre}</p>
                          <p className="truncate text-xs text-muted-foreground">{m.empresa || m.giro || m.pais}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <span className="rounded-full bg-teal-600/10 px-2 py-0.5 text-xs font-medium text-teal-700 dark:text-teal-300">
                          {nivelLabel(m.nivel, dispLang)}
                        </span>
                        {m.certificado && (
                          <span className="rounded-full bg-emerald-600/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">✓ {t('Certificado', 'Certified')}</span>
                        )}
                        {m.madurez != null && (
                          <span className="rounded-full bg-glass px-2 py-0.5 text-xs text-muted-foreground">{t('Madurez', 'Maturity')}: {m.madurez}/120</span>
                        )}
                        {m.rolRepSale && (
                          <span className="rounded-full bg-glass px-2 py-0.5 text-xs text-muted-foreground">{t('Rep Sale', 'Rep Sale')}</span>
                        )}
                      </div>
                    </button>
                  ))}
              </div>
              {miembros.length === 0 && <p className="text-sm text-muted-foreground">{t('Aún no hay miembros.', 'No members yet.')}</p>}
            </div>
          )}
        </>
      )}

      {/* Modal perfil público */}
      {perfilUid && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setPerfilUid(null)}>
          <div className="glass-panel relative max-h-[85vh] w-full max-w-lg overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setPerfilUid(null)} className="absolute right-3 top-3 text-muted-foreground hover:text-foreground">
              <X className="h-5 w-5" />
            </button>
            {perfilLoading && <p className="text-sm text-muted-foreground">{t('Cargando perfil...', 'Loading profile...')}</p>}
            {!perfilLoading && perfilData && (
              <div className="space-y-4">
                <div className="text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-teal-600 text-xl font-bold text-white">
                    {perfilData.nombre.slice(0, 2).toUpperCase() || '?'}
                  </div>
                  <h2 className="mt-2 text-lg font-semibold text-foreground">{perfilData.nombre}</h2>
                  <p className="text-sm text-muted-foreground">
                    {perfilData.empresa || perfilData.giro}
                    {perfilData.pais && <> · {perfilData.pais}</>}
                  </p>
                  <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                    <span className="rounded-full bg-teal-600/10 px-2 py-0.5 text-xs font-semibold text-teal-700 dark:text-teal-300">
                      {dispLang === 'en' ? perfilData.nivel.en : perfilData.nivel.es}
                    </span>
                    {perfilData.certificado && (
                      <span className="rounded-full bg-emerald-600/10 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                        ✓ {t('Certificado MBE', 'MBE Certified')}
                      </span>
                    )}
                    {perfilData.rolRepSale && (
                      <span className="rounded-full bg-glass px-2 py-0.5 text-xs font-medium text-muted-foreground">{t('Rep Dales', 'Rep Sale')}</span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="rounded-lg border border-glass-border bg-glass p-3">
                    <p className="text-xs text-muted-foreground">{t('Reuniones B2B', 'B2B meetings')}</p>
                    <p className="mt-1 text-lg font-bold text-foreground">{perfilData.reunionesCompletadas}</p>
                  </div>
                  <div className="rounded-lg border border-glass-border bg-glass p-3">
                    <p className="text-xs text-muted-foreground">{t('Resultados ($)', 'Results ($)')}</p>
                    <p className="mt-1 text-lg font-bold text-emerald-700 dark:text-emerald-300">{fmtMoneda(perfilData.montoResultados)}</p>
                  </div>
                </div>

                {perfilData.telefono && (
                  <div className="flex items-center gap-2 rounded-lg border border-glass-border bg-glass px-3 py-2 text-sm text-foreground">
                    <Phone className="h-4 w-4 shrink-0 text-teal-600" />
                    <a href={`tel:${perfilData.telefono}`} className="truncate hover:underline">{perfilData.telefono}</a>
                  </div>
                )}
                <div className="flex items-center gap-2 rounded-lg border border-glass-border bg-glass px-3 py-2 text-sm text-foreground">
                  <LogIn className="h-4 w-4 shrink-0 text-teal-600" />
                  <a href={`mailto:${perfilData.email}`} className="truncate hover:underline">{perfilData.email}</a>
                </div>

                {perfilData.madurez && (
                  <div className="rounded-lg border border-glass-border bg-glass p-4">
                    <div className="flex items-center gap-2">
                      <Medal className="h-4 w-4 text-teal-600" />
                      <h3 className="text-sm font-semibold text-foreground">{t('Nivel de madurez', 'Maturity level')}</h3>
                    </div>
                    {perfilData.madurez.totalScore != null && (
                      <div className="mt-2 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{t('Puntaje', 'Score')}</span>
                        <span className="font-bold text-foreground">{perfilData.madurez.totalScore} / 120</span>
                      </div>
                    )}
                    {perfilData.madurez.nivelGlobal && (
                      <div className="mt-1 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{t('Nivel global', 'Global level')}</span>
                        <span className="font-bold text-foreground">{nivelGlobalLabel(perfilData.madurez.nivelGlobal, dispLang)}</span>
                      </div>
                    )}
                    {perfilData.madurez.fecha && (
                      <p className="mt-2 text-xs text-muted-foreground">{t('Evaluación del', 'Assessed on')} {new Date(perfilData.madurez.fecha).toLocaleDateString()}</p>
                    )}
                  </div>
                )}

                {perfilData.resultados.length > 0 && (
                  <div className="rounded-lg border border-glass-border bg-glass p-4">
                    <h3 className="text-sm font-semibold text-foreground">{t('Resultados de reuniones', 'Meeting results')}</h3>
                    <div className="mt-2 space-y-2">
                      {perfilData.resultados.map((r, i) => (
                        <div key={i} className="text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">{TIPOS_RESULTADO.find((x) => x.id === r.tipo)?.es || r.tipo}</span>
                          {r.monto > 0 && <span className="ml-1 font-semibold text-emerald-700 dark:text-emerald-300">{fmtMoneda(r.monto)}</span>}
                          {r.descripcion && <span> — {r.descripcion}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            {!perfilLoading && !perfilData && (
              <p className="text-sm text-red-600">{t('No se pudo cargar este perfil.', 'Could not load this profile.')}</p>
            )}
          </div>
        </div>
      )}

      {/* Modal registro de resultado */}
      {resReunion && yo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setResReunion(null)}>
          <div className="glass-panel relative w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setResReunion(null)} className="absolute right-3 top-3 text-muted-foreground hover:text-foreground">
              <X className="h-5 w-5" />
            </button>
            <h2 className="text-base font-semibold text-foreground">{t('Registrar resultado de la reunión', 'Log the meeting result')}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{resReunion.titulo}</p>
            <div className="mt-4 space-y-3">
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">{t('Tipo de resultado', 'Result type')}</p>
                <select
                  className="w-full rounded-lg border border-glass-border bg-glass px-3 py-2 text-sm text-foreground"
                  value={resTipo}
                  onChange={(e) => setResTipo(e.target.value as TipoResultado)}
                >
                  {TIPOS_RESULTADO.map((x) => <option key={x.id} value={x.id}>{dispLang === 'en' ? x.en : x.es}</option>)}
                </select>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  {t('Monto ($)', 'Amount ($)')}
                  {montoRequerido(resTipo) && <span className="text-red-600"> *</span>}
                </p>
                <input
                  type="number"
                  className="w-full rounded-lg border border-glass-border bg-glass px-3 py-2 text-sm text-foreground"
                  value={resMonto}
                  onChange={(e) => setResMonto(e.target.value)}
                  placeholder="0.00"
                />
                {montoRequerido(resTipo) && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('Indica el monto en dinero; es obligatorio para compra, trueque o referencia.', 'Enter the money amount; it is required for purchases, barter or referrals.')}
                  </p>
                )}
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">{t('Descripción', 'Description')}</p>
                <textarea
                  className="w-full rounded-lg border border-glass-border bg-glass px-3 py-2 text-sm text-foreground"
                  rows={2}
                  value={resDesc}
                  onChange={(e) => setResDesc(e.target.value)}
                />
              </div>
              <button
                type="button"
                disabled={busy === 'registrar-resultado' || (montoRequerido(resTipo) && !(Number(resMonto) > 0))}
                onClick={() => act('registrar-resultado', { reunionId: resReunion.id, tipo: resTipo, monto: Number(resMonto) || 0, descripcion: resDesc }, t('Resultado registrado.', 'Result logged.'))}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-700 disabled:opacity-60"
              >
                {busy === 'registrar-resultado' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {t('Guardar resultado', 'Save result')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
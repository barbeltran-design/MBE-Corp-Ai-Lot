'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';
import { useDisplayLang } from '@/components/display-lang-provider';
import { useUserRoles } from '@/lib/use-user-roles';
import {
  ArrowDown,
  ArrowUp,
  CalendarClock,
  Check,
  Crown,
  Link2,
  Loader2,
  LogIn,
  Medal,
  Minus,
  Newspaper,
  Plus,
  RefreshCw,
  Save,
  Star,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { AGENDA_JUNTA, AGENDA_JUNTA_TOTAL, ROLES_JUNTA, rolLabel, nivelDesdePuntos } from '@/lib/club';
import { nivelLabel } from '@/lib/refplace';
import { nivelMinimoNoticiasLabel } from '@/lib/premium';

// Liga tal cual la ingresó el usuario pero siempre con protocolo, para que el
// navegador no la resuelva contra el origen de la app (ej. meet.google.com/...).
function ligaHref(liga: string): string {
  return /^https?:\/\//i.test(liga) ? liga : 'https://' + liga;
}

interface AgendaItemView {
  id: string;
  titulo: string;
  descripcion: string;
  responsable: string;
  duracionMin: number;
}

interface JuntaView {
  id: string;
  tipo: string;
  nombre: string;
  fecha: string;
  hora: string;
  liga: string;
  ubicacion: string;
  objetivo: string;
  precio: number;
  semanaMes: number;
  temaDefinido: string;
  agenda?: AgendaItemView[];
  roles: Record<string, { uid: string; nombre: string } | null>;
  asistentes: Record<string, { confirmado: boolean }>;
  estatus: string;
}

interface NoticiaView {
  id: string;
  titulo: string;
  contenido: string;
  autorUid: string;
  autorNombre: string;
  estatus: 'pendiente' | 'aprobada' | 'rechazada';
  creadoEn: string;
  aprobadoPor?: string;
  aprobadoEn?: string;
  motivoRechazo?: string;
}

interface ResumenDatos {
  yo: {
    uid: string;
    nombre: string;
    puntos: number;
    nivel: string;
    puntosFaltan: number;
    siguienteNivel: { id: string; es: string; en: string } | null;
    primerJuntaAt: string;
    semanasJunta: number;
    certificado: boolean;
    nivelComunidad: string;
    puedeCrearNoticias: boolean;
  };
  miembros: { uid: string; nombre: string; email: string; puntos: number; nivel: string }[];
  semanaActual: number;
  trimestre: string;
  tematicaSemana: { es: string; en: string };
  juntaActual: JuntaView | null;
  juntas: JuntaView[];
  misRolesJunta: string[];
  rankings: { trimestre: RankRow[]; historico: RankRow[] };
  puntosSemana: { id: string; userId: string; categoria: string; valor: number; fecha: string; nota: string }[];
  niveles: { id: string; umbral: number; es: string; en: string }[];
  catalogo: { id: string; es: string; en: string; valor: number }[];
  agendaEjemplo: AgendaItemView[];
  totalMinutosAgenda: number;
  noticiasAprobadas: NoticiaView[];
  noticiasPendientes: NoticiaView[];
  cumpleanosHoy: { uid: string; nombre: string }[];
  nivelMinimoNoticias: { id: string; es: string; en: string } | null;
}

interface RankRow {
  uid: string;
  nombre: string;
  puntos: number;
  nivel?: string;
  posicion: number;
}

type TabId = 'semana' | 'puntos' | 'organizar' | 'noticias';

const NEGATIVOS = new Set(['entrega_mala', 'no_cumplir']);

function fmtFecha(fecha: string): string {
  const d = new Date(fecha + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return fecha;
  return d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function ClubBuilder() {
  const params = useParams();
  const routeLocale = typeof params.locale === 'string' ? params.locale : 'es';
  const { lang } = useDisplayLang();
  const { administracion } = useUserRoles();
  const [dispLang, setDispLang] = React.useState<'es' | 'en'>(routeLocale === 'en' ? 'en' : 'es');
  React.useEffect(() => { setDispLang(lang); }, [lang]);
  const t = (es: string, en: string) => (dispLang === 'en' ? en : es);

  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');
  const [data, setData] = React.useState<ResumenDatos | null>(null);
  const [tab, setTab] = React.useState<TabId>('semana');
  const [agendaSel, setAgendaSel] = React.useState<AgendaItemView[] | null>(null);
  const [temaSel, setTemaSel] = React.useState('');
  const [confirmado, setConfirmado] = React.useState(false);

  // Perfil publico de quien ocupa un rol
  const [perfilUid, setPerfilUid] = React.useState<string | null>(null);
  const [perfilInfo, setPerfilInfo] = React.useState<{
    nombre: string;
    email: string;
    telefono: string;
    empresa: string;
    nivel: { id: string; es: string; en: string } | null;
    certificado: boolean;
  } | null>(null);

  // Formularios de organizacion
  const [njFecha, setNjFecha] = React.useState('');
  const [njHora, setNjHora] = React.useState('19:00');
  const [njLiga, setNjLiga] = React.useState('');
  const [evNombre, setEvNombre] = React.useState('');
  const [evFecha, setEvFecha] = React.useState('');
  const [evHora, setEvHora] = React.useState('19:00');
  const [evUbicacion, setEvUbicacion] = React.useState('');
  const [evObjetivo, setEvObjetivo] = React.useState('');
  const [evPrecio, setEvPrecio] = React.useState('');
  const [rolSel, setRolSel] = React.useState<Record<string, string>>({});
  const [asignarOpen, setAsignarOpen] = React.useState(false);
  const [ptsMiembros, setPtsMiembros] = React.useState<Record<string, boolean>>({});
  const [ptsCats, setPtsCats] = React.useState<Record<string, boolean>>({});
  const [ptsNota, setPtsNota] = React.useState('');
  const [ajUser, setAjUser] = React.useState('');
  const [ajValor, setAjValor] = React.useState('');
  const [ntTitulo, setNtTitulo] = React.useState('');
  const [ntContenido, setNtContenido] = React.useState('');
  const [rechazoAbiertoId, setRechazoAbiertoId] = React.useState<string | null>(null);
  const [rechazoMotivo, setRechazoMotivo] = React.useState('');

  async function cargar(token: string): Promise<ResumenDatos> {
    const res = await fetch('/api/club', { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error('load failed');
    return res.json();
  }

  function aplicar(d: ResumenDatos) {
    setData(d);
    if (d.juntaActual && d.juntaActual.agenda) {
      setAgendaSel(d.juntaActual.agenda.map((i) => ({ ...i })));
      setTemaSel(d.juntaActual.temaDefinido);
      setConfirmado(d.juntaActual.asistentes[d.yo.uid]?.confirmado === true);
      const sel: Record<string, string> = {};
      for (const r of ROLES_JUNTA) sel[r.id] = d.juntaActual.roles[r.id]?.uid ?? '';
      setRolSel(sel);
    }
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
        .then(async (token) => { aplicar(await cargar(token)); })
        .catch((err) => {
          console.error('[club] load failed', err);
          if (!cancelled) setError(t('No se pudo cargar la Comunidad de Mentoría Semanal.', 'Could not load the Weekly Mentoring Community.'));
        })
        .finally(() => { if (!cancelled) setLoading(false); });
    });
    return () => { cancelled = true; unsub(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function act(accion: string, body: Record<string, unknown>, okEs: string, okEn?: string) {
    if (!user) return;
    setBusy(accion);
    setError('');
    setSuccess('');
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/club', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion, ...body }),
      });
      const r = await res.json();
      if (!res.ok) throw new Error(r.error || 'request failed');
      setSuccess(t(okEs, okEn ?? okEs));
      aplicar(await cargar(token));
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
      aplicar(await cargar(token));
    } catch {
      setError(t('No se pudo actualizar.', 'Could not refresh.'));
    } finally {
      setBusy(null);
    }
  }

  async function abrirPerfil(uidArg: string) {
    if (!user) return;
    setPerfilUid(uidArg);
    setPerfilInfo(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/refplace/perfil?uid=${encodeURIComponent(uidArg)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const r = (await res.json()) as {
        perfil?: {
          nombre: string;
          email: string;
          telefono: string;
          empresa: string;
          nivel: { id: string; es: string; en: string } | null;
          certificado: boolean;
        };
      };
      if (res.ok && r.perfil) setPerfilInfo(r.perfil);
    } catch (err) {
      console.error('[club] perfil failed', err);
    }
  }

  const ja = data?.juntaActual ?? null;
  const rolesJa = ja ? (data?.juntas.find((j) => j.id === ja.id)?.roles ?? ja.roles) : null;
  const miUid = user?.uid ?? '';
  const soyCoord = ja ? rolesJa?.coordinador?.uid === miUid : false;
  const soyCalidad = ja ? rolesJa?.mentor_calidad?.uid === miUid : false;
  const soyCrecimiento = ja ? rolesJa?.mentor_crecimiento?.uid === miUid : false;
  const esAdmin = administracion;

  const yo = data?.yo ?? null;
  const agenda = agendaSel ?? ja?.agenda ?? data?.agendaEjemplo ?? [];
  const sumaAgenda = agenda.reduce((a, x) => a + x.duracionMin, 0);
  const eventos = (data?.juntas ?? []).filter((j) => j.tipo === 'evento' && j.estatus === 'programada');
  const miembrosSel = data?.miembros ?? [];

  function moveAgenda(idx: number, dir: -1 | 1) {
    setAgendaSel((prev) => {
      const cur = prev ?? agenda;
      const next = cur.map((i) => ({ ...i }));
      const j = idx + dir;
      if (j < 0 || j >= next.length) return cur;
      const tmp = next[idx];
      next[idx] = next[j];
      next[j] = tmp;
      return next;
    });
  }

  function cambiaDuracion(idx: number, delta: number) {
    setAgendaSel((prev) => {
      const cur = prev ?? agenda;
      return cur.map((it, i2) => (i2 === idx ? { ...it, duracionMin: Math.max(1, Math.min(90, it.duracionMin + delta)) } : it));
    });
  }

  const catalogo = data?.catalogo ?? [];
  const niveles = data?.niveles ?? [];
  const rankingTrimBase = data?.rankings.trimestre ?? [];
  const rankingHistBase = data?.rankings.historico ?? [];

  // ---------- Tab: semana ----------
  const renderSemana = () => (
    <div className="space-y-6">
      {!ja && (
        <div className="glass-panel p-6 text-center text-sm text-muted-foreground">
          {t('No hay junta programada todavia. El administrador publicara el horario proximamente.', 'No meeting scheduled yet. The administrator will publish the schedule soon.')}
        </div>
      )}

      {ja && (
        <>
          {/* Encabezado de la junta */}
          <div className="glass-panel p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 text-lg font-semibold text-foreground">
                  <Users className="h-5 w-5 text-teal-600" />
                  {ja.nombre}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {fmtFecha(ja.fecha)} · {ja.hora} hs
                  {ja.liga && (
                    <a href={ligaHref(ja.liga)} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-1 text-teal-700 hover:underline dark:text-teal-300">
                      <Link2 className="h-3.5 w-3.5" /> {ja.liga}
                    </a>
                  )}
                </p>
                {ja.ubicacion && <p className="mt-0.5 text-xs text-muted-foreground">{ja.ubicacion}</p>}
                {ja.objetivo && <p className="mt-0.5 text-xs text-muted-foreground">{ja.objetivo}</p>}
              </div>
              <span className="rounded-full bg-glass px-2.5 py-1 text-xs font-medium text-muted-foreground">
                {t('Semana', 'Week')} {ja.semanaMes}
              </span>
            </div>

            {/* Tema del tutorial */}
            <div className="mt-3 rounded-lg border border-glass-border bg-glass p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('Tema del Tutorial de esta semana', 'This week Tutorial topic')}</p>
              <p className="mt-1 text-sm font-medium text-foreground">{ja.temaDefinido || (dispLang === 'en' ? data?.tematicaSemana.en : data?.tematicaSemana.es)}</p>
              {(soyCrecimiento || esAdmin) && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <input
                    value={temaSel}
                    onChange={(e) => setTemaSel(e.target.value)}
                    placeholder={t('Escribe el tema del Tutorial de esta semana...', "Write this week's Tutorial topic...")}
                    className="min-w-0 flex-1 rounded-lg border border-glass-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-teal-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled={busy === 'definir-tema'}
                    onClick={() => void act('definir-tema', { juntaId: ja.id, tema: temaSel }, 'Tema definido.', 'Topic set.')}
                    className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-700 disabled:opacity-60"
                  >
                    {busy === 'definir-tema' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {t('Definir tema', 'Set topic')}
                  </button>
                </div>
              )}
            </div>

            {/* Confirmar asistencia */}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={busy === 'confirmar'}
                onClick={() => void act('confirmar', { juntaId: ja.id, confirmado: !confirmado }, 'Asistencia confirmada.', 'Attendance confirmed.')}
                className={
                  'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60 ' +
                  (confirmado ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-glass text-foreground hover:bg-teal-600 hover:text-white')
                }
              >
                {busy === 'confirmar' ? <Loader2 className="h-4 w-4 animate-spin" /> : confirmado ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {confirmado ? t('Confirme mi asistencia', 'I confirmed my attendance') : t('Confirmar mi asistencia', 'Confirm my attendance')}
              </button>
              <span className="text-xs text-muted-foreground">
                {Object.values(ja.asistentes).filter((a) => a.confirmado).length} {t('asistentes confirmados', 'attendees confirmed')}
              </span>
            </div>
          </div>

          {/* Roles de la junta */}
          <div className="glass-panel p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">{t('Roles de la junta directiva', 'Board roles')}</p>
              {(esAdmin || soyCoord) && (
                <button
                  type="button"
                  onClick={() => setAsignarOpen((prev) => !prev)}
                  className="inline-flex items-center gap-2 rounded-lg border border-teal-600 px-3 py-1.5 text-xs font-semibold text-teal-700 transition-colors hover:bg-teal-50 dark:text-teal-300 dark:hover:bg-teal-500/10"
                >
                  <Crown className="h-3.5 w-3.5" />
                  {asignarOpen ? t('Cerrar', 'Close') : t('Asignar roles', 'Assign roles')}
                </button>
              )}
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {ROLES_JUNTA.map((r) => {
                const asignado = rolesJa ? rolesJa[r.id] ?? null : null;
                const miRol = asignado?.uid === miUid;
                return (
                  <div key={r.id} className={'rounded-lg border p-2.5 ' + (miRol ? 'border-teal-500 bg-teal-50 dark:bg-teal-950/40' : 'border-glass-border bg-glass')}>
                    <p className="text-xs font-medium text-muted-foreground">{rolLabel(r.id, dispLang)}</p>
                    {asignado ? (
                      <button
                        type="button"
                        onClick={() => void abrirPerfil(asignado.uid)}
                        className="mt-1 flex w-full items-center gap-1.5 text-left text-sm font-semibold text-foreground hover:text-teal-700 dark:hover:text-teal-300"
                      >
                        {miRol && <Crown className="h-3.5 w-3.5 shrink-0 text-teal-600" />}
                        <span className="truncate">{asignado.nombre}</span>
                      </button>
                    ) : (
                      <p className="mt-1 text-xs italic text-muted-foreground">{t('Por asignar', 'To be assigned')}</p>
                    )}
                  </div>
                );
              })}
            </div>

            {asignarOpen && (esAdmin || soyCoord) && (
              <div className="mt-4 rounded-lg border border-glass-border bg-glass p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('Asignar roles de la junta actual', 'Assign roles for the current meeting')}
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                  {ROLES_JUNTA.map((r) => (
                    <div key={r.id} className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">{rolLabel(r.id, dispLang)}</label>
                      <select
                        value={rolSel[r.id] ?? ''}
                        onChange={(e) => setRolSel((prev) => ({ ...prev, [r.id]: e.target.value }))}
                        className="w-full rounded-lg border border-glass-border bg-background px-2 py-1.5 text-sm text-foreground focus:border-teal-500 focus:outline-none"
                      >
                        <option value="">{t('Sin asignar', 'Unassigned')}</option>
                        {miembrosSel.map((m) => (
                          <option key={m.uid} value={m.uid}>{m.nombre || m.email}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={busy === 'asignar-roles'}
                  onClick={() => void act('asignar-roles', { juntaId: ja.id, roles: rolSel }, 'Roles asignados.', 'Roles assigned.')}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-700 disabled:opacity-50"
                >
                  {busy === 'asignar-roles' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {t('Guardar roles', 'Save roles')}
                </button>
              </div>
            )}
          </div>

          {/* Agenda de 90 minutos */}
          <div className="glass-panel p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">
                {t('Agenda', 'Agenda')}{' '}
                <span className={'ml-1 text-xs font-medium ' + (sumaAgenda === AGENDA_JUNTA_TOTAL ? 'text-emerald-600' : 'text-red-600')}>
                  {sumaAgenda}/{AGENDA_JUNTA_TOTAL} {t('min', 'min')}
                </span>
              </p>
              {(soyCoord || esAdmin) && (
                <button
                  type="button"
                  disabled={busy === 'reordenar-agenda' || sumaAgenda !== AGENDA_JUNTA_TOTAL}
                  onClick={() => void act('reordenar-agenda', { juntaId: ja.id, agenda }, 'Agenda actualizada.', 'Agenda updated.')}
                  className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-700 disabled:opacity-50"
                >
                  {busy === 'reordenar-agenda' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {t('Guardar agenda', 'Save agenda')}
                </button>
              )}
            </div>
            <div className="mt-3 space-y-2">
              {agenda.map((item, idx) => (
                <div key={item.id + '-' + idx} className="rounded-lg border border-glass-border bg-glass p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {(soyCoord || esAdmin) && (
                      <span className="flex items-center gap-1">
                        <button type="button" onClick={() => moveAgenda(idx, -1)} disabled={idx === 0} className="rounded border border-glass-border p-1 text-muted-foreground hover:text-foreground disabled:opacity-40">
                          <ArrowUp className="h-3 w-3" />
                        </button>
                        <button type="button" onClick={() => moveAgenda(idx, 1)} disabled={idx === agenda.length - 1} className="rounded border border-glass-border p-1 text-muted-foreground hover:text-foreground disabled:opacity-40">
                          <ArrowDown className="h-3 w-3" />
                        </button>
                      </span>
                    )}
                    <span className="font-semibold text-foreground">{agendaSel && item.responsable === rolesJa?.coordinador?.uid ? item.titulo : t(item.titulo, item.titulo)}</span>
                    <span className="text-xs text-muted-foreground">· {rolLabel(item.responsable, dispLang)}</span>
                    {(soyCoord || esAdmin) ? (
                      <span className="ml-auto flex items-center gap-1">
                        <button type="button" onClick={() => cambiaDuracion(idx, -5)} className="rounded border border-glass-border p-1 text-muted-foreground hover:text-foreground">
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-12 text-center text-sm font-semibold">{item.duracionMin} min</span>
                        <button type="button" onClick={() => cambiaDuracion(idx, 5)} className="rounded border border-glass-border p-1 text-muted-foreground hover:text-foreground">
                          <Plus className="h-3 w-3" />
                        </button>
                      </span>
                    ) : (
                      <span className="ml-auto rounded-full bg-glass px-2 py-0.5 text-xs font-medium text-muted-foreground">{item.duracionMin} min</span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{item.descripcion}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Proximos eventos */}
      {eventos.length > 0 && (
        <div className="glass-panel p-4">
          <p className="text-sm font-semibold text-foreground">{t('Eventos de la comunidad', 'Community events')}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {eventos.map((ev) => (
              <div key={ev.id} className="rounded-lg border border-glass-border bg-glass p-3">
                <p className="font-semibold text-foreground">{ev.nombre}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {fmtFecha(ev.fecha)} · {ev.hora}
                  {ev.ubicacion && <> · {ev.ubicacion}</>}
                </p>
                {ev.objetivo && <p className="mt-1 text-xs text-muted-foreground">{ev.objetivo}</p>}
                {ev.precio > 0 && <p className="mt-1 text-xs font-semibold text-teal-700 dark:text-teal-300">${ev.precio.toLocaleString('en-US')}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // ---------- Tab: puntos y niveles ----------
  const renderPuntos = () => (
    <div className="space-y-6">
      {/* Ranking trimestral */}
      <div className="glass-panel p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Star className="h-4 w-4 text-teal-600" /> {t('Ranking del trimestre', 'Quarterly ranking')}
          <span className="text-xs text-muted-foreground">({data?.trimestre})</span>
        </p>
        {rankingTrimBase.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">{t('Todavia no hay movimientos este trimestre.', 'No movements this quarter yet.')}</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-glass-border text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3">#</th>
                  <th className="py-2 pr-3">{t('Miembro', 'Member')}</th>
                  <th className="py-2">{t('Puntos', 'Points')}</th>
                </tr>
              </thead>
              <tbody>
                {rankingTrimBase.map((r) => (
                  <tr key={r.uid} className={'border-b border-glass-border/50 ' + (r.uid === miUid ? 'bg-teal-50 dark:bg-teal-950/40' : '')}>
                    <td className="py-2 pr-3 font-bold text-muted-foreground">{r.posicion}</td>
                    <td className="py-2 pr-3 font-medium text-foreground">{r.nombre}{r.uid === miUid && <span className="ml-1 text-xs text-teal-600">(yo)</span>}</td>
                    <td className="py-2 font-semibold text-teal-700 dark:text-teal-300">{r.puntos}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Ranking historico */}
      <div className="glass-panel p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Medal className="h-4 w-4 text-teal-600" /> {t('Ranking historico', 'All-time ranking')}
        </p>
        {rankingHistBase.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">{t('Todavia no hay participantes con puntos.', 'No participants with points yet.')}</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-glass-border text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3">#</th>
                  <th className="py-2 pr-3">{t('Miembro', 'Member')}</th>
                  <th className="py-2 pr-3">{t('Nivel', 'Level')}</th>
                  <th className="py-2">{t('Puntos', 'Points')}</th>
                </tr>
              </thead>
              <tbody>
                {rankingHistBase.map((r) => (
                  <tr key={r.uid} className={'border-b border-glass-border/50 ' + (r.uid === miUid ? 'bg-teal-50 dark:bg-teal-950/40' : '')}>
                    <td className="py-2 pr-3 font-bold text-muted-foreground">{r.posicion}</td>
                    <td className="py-2 pr-3 font-medium text-foreground">{r.nombre}{r.uid === miUid && <span className="ml-1 text-xs text-teal-600">(yo)</span>}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{nivelLabel(r.nivel ?? 'godin_wannabe', dispLang)}</td>
                    <td className="py-2 font-semibold text-teal-700 dark:text-teal-300">{r.puntos}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Catalogo de puntos */}
      <div className="glass-panel p-4">
        <p className="text-sm font-semibold text-foreground">{t('Catalogo de puntos', 'Points catalogue')}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {catalogo.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-lg border border-glass-border bg-glass px-3 py-2">
              <span className="text-sm text-foreground">{dispLang === 'en' ? c.en : c.es}</span>
              {NEGATIVOS.has(c.id) ? (
                <span className="text-sm font-bold text-red-600 dark:text-red-400">{c.valor}</span>
              ) : (
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">+{c.valor}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Tabla de niveles */}
      <div className="glass-panel p-4">
        <p className="text-sm font-semibold text-foreground">{t('Niveles de la comunidad', 'Community levels')}</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-glass-border text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-3">{t('Nivel', 'Level')}</th>
                <th className="py-2 pr-3">{t('Puntos', 'Points')}</th>
                <th className="py-2">{t('Acceso', 'Access')}</th>
              </tr>
            </thead>
            <tbody>
              {niveles.map((n) => (
                <tr key={n.id} className={'border-b border-glass-border/50 ' + (n.id === yo?.nivel ? 'bg-teal-50 dark:bg-teal-950/40' : '')}>
                  <td className="py-2 pr-3 font-medium text-foreground">{dispLang === 'en' ? n.en : n.es}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{n.umbral}</td>
                  <td className="py-2 text-xs text-muted-foreground">
                    {n.id === 'godin_wannabe' || n.id === 'freelancero' || n.id === 'emprendedor'
                      ? t('Reuniones B2B', 'B2B meetings')
                      : n.id === 'empresario_orquesta'
                        ? t('B2B + Referencias + Reference Place', 'B2B + Referrals + Reference Place')
                        : t('B2B + Referencias + Inversiones', 'B2B + Referrals + Investments')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // ---------- Tab: organizar ----------
  const puedeOrganizar = esAdmin || soyCoord || soyCalidad;
  const renderOrganizar = () => (
    <div className="space-y-4">
      {!puedeOrganizar ? (
        <div className="glass-panel p-6 text-center text-sm text-muted-foreground">
          {t('La organizacion de las juntas la lleva el coordinador, el Mentor de Calidad y los administradores.', 'Meeting management is handled by the coordinator, the Quality Mentor and administrators.')}
        </div>
      ) : (
        <>
          {/* Crear junta */}
          {esAdmin && (
            <div className="glass-panel p-4">
              <p className="text-sm font-semibold text-foreground">{t('Crear junta semanal', 'Create weekly meeting')}</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-4">
                <input type="date" value={njFecha} onChange={(e) => setNjFecha(e.target.value)} className="rounded-lg border border-glass-border bg-background px-3 py-2 text-sm text-foreground focus:border-teal-500 focus:outline-none" />
                <input type="time" value={njHora} onChange={(e) => setNjHora(e.target.value)} className="rounded-lg border border-glass-border bg-background px-3 py-2 text-sm text-foreground focus:border-teal-500 focus:outline-none" />
                <input
                  value={njLiga}
                  onChange={(e) => setNjLiga(e.target.value)}
                  placeholder={t('Liga (opcional)', 'Link (optional)')}
                  className="rounded-lg border border-glass-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-teal-500 focus:outline-none sm:col-span-2"
                />
              </div>
              <button
                type="button"
                disabled={busy === 'crear-junta' || !njFecha || !njHora}
                onClick={() => void act('crear-junta', { fecha: njFecha, hora: njHora, liga: njLiga }, 'Junta creada.', 'Meeting created.')}
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-700 disabled:opacity-50"
              >
                {busy === 'crear-junta' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {t('Crear junta', 'Create meeting')}
              </button>
            </div>
          )}

          {/* Crear evento */}
          {esAdmin && (
            <div className="glass-panel p-4">
              <p className="text-sm font-semibold text-foreground">{t('Crear evento', 'Create event')}</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <input value={evNombre} onChange={(e) => setEvNombre(e.target.value)} placeholder={t('Nombre del evento', 'Event name')} className="rounded-lg border border-glass-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-teal-500 focus:outline-none" />
                <input type="date" value={evFecha} onChange={(e) => setEvFecha(e.target.value)} className="rounded-lg border border-glass-border bg-background px-3 py-2 text-sm text-foreground focus:border-teal-500 focus:outline-none" />
                <input type="time" value={evHora} onChange={(e) => setEvHora(e.target.value)} className="rounded-lg border border-glass-border bg-background px-3 py-2 text-sm text-foreground focus:border-teal-500 focus:outline-none" />
                <input value={evPrecio} onChange={(e) => setEvPrecio(e.target.value)} placeholder={t('Precio (MXN)', 'Price (MXN)')} type="number" className="rounded-lg border border-glass-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-teal-500 focus:outline-none" />
                <input value={evUbicacion} onChange={(e) => setEvUbicacion(e.target.value)} placeholder={t('Ubicacion', 'Location')} className="rounded-lg border border-glass-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-teal-500 focus:outline-none" />
                <input value={evObjetivo} onChange={(e) => setEvObjetivo(e.target.value)} placeholder={t('Objetivo del evento', 'Event objective')} className="rounded-lg border border-glass-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-teal-500 focus:outline-none sm:col-span-2" />
              </div>
              <button
                type="button"
                disabled={busy === 'crear-evento' || !evNombre || !evFecha || !evHora}
                onClick={() => void act('crear-evento', { nombre: evNombre, fecha: evFecha, hora: evHora, ubicacion: evUbicacion, objetivo: evObjetivo, precio: evPrecio === '' ? undefined : Number(evPrecio) }, 'Evento creado.', 'Event created.')}
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-700 disabled:opacity-50"
              >
                {busy === 'crear-evento' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {t('Crear evento', 'Create event')}
              </button>
            </div>
          )}

          {/* Asignar roles */}
          {(esAdmin || soyCoord) && ja && (
            <div className="glass-panel p-4">
              <p className="text-sm font-semibold text-foreground">
                {t('Roles de la proxima junta', 'Roles for the next meeting')} <span className="text-xs text-muted-foreground">({ja.nombre})</span>
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                {ROLES_JUNTA.map((r) => (
                  <div key={r.id} className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">{rolLabel(r.id, dispLang)}</label>
                    <select
                      value={rolSel[r.id] ?? ''}
                      onChange={(e) => setRolSel((prev) => ({ ...prev, [r.id]: e.target.value }))}
                      className="w-full rounded-lg border border-glass-border bg-background px-2 py-1.5 text-sm text-foreground focus:border-teal-500 focus:outline-none"
                    >
                      <option value="">{t('Sin asignar', 'Unassigned')}</option>
                      {miembrosSel.map((m) => (
                        <option key={m.uid} value={m.uid}>{m.nombre}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <button
                type="button"
                disabled={busy === 'asignar-roles'}
                onClick={() => void act('asignar-roles', { juntaId: ja.id, roles: rolSel }, 'Roles asignados.', 'Roles assigned.')}
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-700 disabled:opacity-50"
              >
                {busy === 'asignar-roles' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {t('Guardar roles', 'Save roles')}
              </button>
            </div>
          )}

          {/* Otorgar puntos */}
          {(esAdmin || soyCalidad) && ja && (
            <div className="glass-panel p-4">
              <p className="text-sm font-semibold text-foreground">{t('Otorgar puntos de la junta', 'Award meeting points')}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t('Selecciona a los participantes y las categorias del catalogo.', 'Select participants and catalogue categories.')}</p>
              <div className="mt-3 grid gap-4 lg:grid-cols-2">
                <div className="rounded-lg border border-glass-border bg-glass p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('Participantes', 'Participants')}</p>
                  <div className="mt-2 grid max-h-48 gap-1 overflow-y-auto">
                    {miembrosSel.map((m) => (
                      <label key={m.uid} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm text-foreground hover:bg-glass">
                        <input
                          type="checkbox"
                          checked={ptsMiembros[m.uid] === true}
                          onChange={(e) => setPtsMiembros((prev) => ({ ...prev, [m.uid]: e.target.checked }))}
                          className="h-4 w-4 accent-teal-600"
                        />
                        <span className="truncate">{m.nombre || m.email}</span>
                        <span className="ml-auto text-xs text-muted-foreground">{m.puntos} pts</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="rounded-lg border border-glass-border bg-glass p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('Categorias', 'Categories')}</p>
                  <div className="mt-2 grid max-h-48 gap-1 overflow-y-auto">
                    {catalogo.map((c) => (
                      <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm text-foreground hover:bg-glass">
                        <input
                          type="checkbox"
                          checked={ptsCats[c.id] === true}
                          onChange={(e) => setPtsCats((prev) => ({ ...prev, [c.id]: e.target.checked }))}
                          className="h-4 w-4 accent-teal-600"
                        />
                        <span className="truncate">{dispLang === 'en' ? c.en : c.es}</span>
                        <span className={'ml-auto text-xs font-bold ' + (c.valor < 0 ? 'text-red-600' : 'text-emerald-600')}>+{c.valor}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <input
                  value={ptsNota}
                  onChange={(e) => setPtsNota(e.target.value)}
                  placeholder={t('Nota (opcional)', 'Note (optional)')}
                  className="min-w-0 flex-1 rounded-lg border border-glass-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-teal-500 focus:outline-none"
                />
                <button
                  type="button"
                  disabled={busy === 'otorgar-puntos' || Object.values(ptsMiembros).filter(Boolean).length === 0 || Object.values(ptsCats).filter(Boolean).length === 0}
                  onClick={() => {
                    const cats = Object.entries(ptsCats).filter(([, v]) => v).map(([k]) => k);
                    const items = Object.entries(ptsMiembros)
                      .filter(([, v]) => v)
                      .map(([k]) => ({ userId: k, categorias: cats, nota: ptsNota }));
                    void act('otorgar-puntos', { juntaId: ja.id, items }, 'Puntos otorgados.', 'Points awarded.');
                  }}
                  className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-700 disabled:opacity-50"
                >
                  {busy === 'otorgar-puntos' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trophy className="h-4 w-4" />}
                  {t('Otorgar puntos', 'Award points')}
                </button>
              </div>
            </div>
          )}

          {/* Ajustar puntos (admin) */}
          {esAdmin && (
            <div className="glass-panel p-4">
              <p className="text-sm font-semibold text-foreground">{t('Ajustar puntos', 'Adjust points')}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <select
                  value={ajUser}
                  onChange={(e) => setAjUser(e.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-glass-border bg-background px-3 py-2 text-sm text-foreground focus:border-teal-500 focus:outline-none"
                >
                  <option value="">{t('Selecciona un miembro...', 'Select a member...')}</option>
                  {miembrosSel.map((m) => (
                    <option key={m.uid} value={m.uid}>{m.nombre || m.email} ({m.puntos} pts)</option>
                  ))}
                </select>
                <input
                  type="number"
                  value={ajValor}
                  onChange={(e) => setAjValor(e.target.value)}
                  placeholder={t('Puntos (+/-)', 'Points (+/-)')}
                  className="w-32 rounded-lg border border-glass-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-teal-500 focus:outline-none"
                />
                <button
                  type="button"
                  disabled={busy === 'ajustar-puntos' || !ajUser || ajValor === ''}
                  onClick={() => void act('ajustar-puntos', { userId: ajUser, valor: Number(ajValor) }, 'Puntos ajustados.', 'Points adjusted.')}
                  className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-700 disabled:opacity-50"
                >
                  {busy === 'ajustar-puntos' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {t('Aplicar', 'Apply')}
                </button>
              </div>
            </div>
          )}

          {/* Cerrar junta */}
          {ja && (esAdmin || soyCoord) && (
            <div className="glass-panel p-4">
              <p className="text-sm font-semibold text-foreground">{t('Cerrar junta', 'Close meeting')}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t('Al cerrarla, los asistentes confirmados ganan su punto de asistencia automaticamente.', 'Closing awards each confirmed attendee their attendance point automatically.')}</p>
              <button
                type="button"
                disabled={busy === 'cerrar-junta'}
                onClick={() => void act('cerrar-junta', { juntaId: ja.id }, 'Junta cerrada.', 'Meeting closed.')}
                className="mt-3 inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300"
              >
                {busy === 'cerrar-junta' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {t('Finalizar y otorgar asistencia', 'Finish and award attendance')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );

  // ---------- Tab: noticias ----------
  const nivelMinLbl = nivelMinimoNoticiasLabel(dispLang);
  const renderNoticias = () => (
    <div className="space-y-4">
      {/* Cumpleaños de hoy (subsección por defecto) */}
      <div className="glass-panel p-4">
        <p className="text-sm font-semibold text-foreground">🎂 {t('Cumpleaños de hoy', "Today's birthdays")}</p>
        {data && data.cumpleanosHoy.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {t('Nadie de la comunidad cumple años hoy.', "No one in the community has a birthday today.")}
          </p>
        ) : (
          <ul className="mt-2 space-y-1">
            {(data?.cumpleanosHoy ?? []).map((c) => (
              <li key={c.uid} className="text-sm text-foreground">
                🎉 <span className="font-semibold">{c.nombre || t('Miembro', 'Member')}</span>{' '}
                <span className="text-muted-foreground">{t('¡Feliz cumpleaños!', 'Happy birthday!')}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Crear noticia */}
      <div className="glass-panel p-4">
        <p className="text-sm font-semibold text-foreground">{t('Crear noticia', 'Create news')}</p>
        {!yo?.puedeCrearNoticias ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {t(
              `Solo quienes tengan el nivel "${nivelMinLbl}" o superior, o cuenten con una certificación MBE en su perfil, pueden crear noticias para la comunidad.`,
              `Only members with the "${nivelMinLbl}" level or higher, or an MBE certification on their profile, can create news for the community.`
            )}
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            <input
              value={ntTitulo}
              onChange={(e) => setNtTitulo(e.target.value)}
              placeholder={t('Título de la noticia', 'News title')}
              maxLength={140}
              className="w-full rounded-lg border border-glass-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-teal-500 focus:outline-none"
            />
            <textarea
              value={ntContenido}
              onChange={(e) => setNtContenido(e.target.value)}
              placeholder={t('Contenido de la noticia', 'News content')}
              maxLength={4000}
              rows={4}
              className="w-full rounded-lg border border-glass-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-teal-500 focus:outline-none"
            />
            <button
              type="button"
              disabled={busy === 'crear-noticia' || !ntTitulo.trim() || !ntContenido.trim()}
              onClick={() => {
                void act('crear-noticia', { titulo: ntTitulo.trim(), contenido: ntContenido.trim() }, 'Noticia enviada para aprobación.', 'News submitted for approval.');
                setNtTitulo('');
                setNtContenido('');
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-700 disabled:opacity-50"
            >
              {busy === 'crear-noticia' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {t('Enviar para aprobación', 'Submit for approval')}
            </button>
            <p className="text-xs text-muted-foreground">
              {t('Tu noticia se publicará hasta que un administrador la apruebe.', 'Your news will be published once an administrator approves it.')}
            </p>
          </div>
        )}
      </div>

      {/* Panel de aprobación (solo admin) */}
      {esAdmin && data && data.noticiasPendientes.length > 0 && (
        <div className="glass-panel p-4">
          <p className="text-sm font-semibold text-foreground">{t('Noticias pendientes de aprobación', 'News pending approval')}</p>
          <div className="mt-3 space-y-3">
            {data.noticiasPendientes.map((n) => (
              <div key={n.id} className="rounded-lg border border-glass-border p-3">
                <p className="text-sm font-semibold text-foreground">{n.titulo}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {n.autorNombre || t('Autor desconocido', 'Unknown author')} · {new Date(n.creadoEn).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{n.contenido}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={busy === 'aprobar-noticia'}
                    onClick={() => void act('aprobar-noticia', { noticiaId: n.id }, 'Noticia aprobada.', 'News approved.')}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <Check className="h-3.5 w-3.5" />
                    {t('Aprobar', 'Approve')}
                  </button>
                  {rechazoAbiertoId === n.id ? (
                    <>
                      <input
                        value={rechazoMotivo}
                        onChange={(e) => setRechazoMotivo(e.target.value)}
                        placeholder={t('Motivo (opcional)', 'Reason (optional)')}
                        className="rounded-lg border border-glass-border bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-teal-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        disabled={busy === 'rechazar-noticia'}
                        onClick={() => {
                          void act('rechazar-noticia', { noticiaId: n.id, motivo: rechazoMotivo }, 'Noticia rechazada.', 'News rejected.');
                          setRechazoAbiertoId(null);
                          setRechazoMotivo('');
                        }}
                        className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300"
                      >
                        <X className="h-3.5 w-3.5" />
                        {t('Confirmar rechazo', 'Confirm rejection')}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setRechazoAbiertoId(n.id); setRechazoMotivo(''); }}
                      className="inline-flex items-center gap-2 rounded-lg border border-glass-border bg-glass px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                      {t('Rechazar', 'Reject')}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Noticias publicadas */}
      <div className="glass-panel p-4">
        <p className="text-sm font-semibold text-foreground">{t('Noticias de la comunidad', 'Community news')}</p>
        {data && data.noticiasAprobadas.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{t('Todavía no hay noticias publicadas.', 'No news published yet.')}</p>
        ) : (
          <div className="mt-3 space-y-3">
            {(data?.noticiasAprobadas ?? []).map((n) => (
              <div key={n.id} className="rounded-lg border border-glass-border p-3">
                <p className="text-sm font-semibold text-foreground">{n.titulo}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {n.autorNombre || t('Autor desconocido', 'Unknown author')} · {new Date(n.creadoEn).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{n.contenido}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // ===== PARTE 3: return principal =====
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t('Comunidad de Mentoría Semanal', 'Weekly Mentoring Community')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('Juntas de 90 minutos cada semana, con temas, roles, puntos y niveles.', '90-minute meetings every week, with topics, roles, points and levels.')}
            {data && (
              <span className="ml-1">
                {t('Tema de la semana:', 'This week topic:')}{' '}
                <span className="font-semibold text-teal-700 dark:text-teal-300">
                  {dispLang === 'en' ? data.tematicaSemana.en : data.tematicaSemana.es}
                </span>
              </span>
            )}
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
          <p className="mt-3 text-sm text-muted-foreground">{t('Inicia sesion para ver la Comunidad de Mentoría Semanal.', 'Log in to see the Weekly Mentoring Community.')}</p>
        </div>
      )}

      {!loading && user && data && (
        <>
          {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
          {success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{success}</div>}

          {/* Mi progreso */}
          {yo && (
            <div className="glass-panel p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-600 text-lg font-bold text-white">
                    {(yo.nombre || 'Yo').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{yo.nombre || t('Miembro', 'Member')}</p>
                    <p className="text-xs text-muted-foreground">
                      {t('Nivel:', 'Level:')}{' '}
                      <span className="font-semibold text-teal-700 dark:text-teal-300">{nivelLabel(yo.nivel, dispLang)}</span>
                      {yo.semanasJunta > 0 && (
                        <span className="ml-2">· {yo.semanasJunta} {t('juntas asistidas', 'meetings attended')}</span>
                      )}
                      {yo.primerJuntaAt && (
                        <span className="ml-2">
                          · {t('miembro desde', 'member since')}{' '}
                          {new Date(yo.primerJuntaAt).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-glass px-2.5 py-1 text-xs font-medium text-muted-foreground">
                    <Trophy className="mr-1 inline h-3 w-3 text-teal-600" />
                    {t('Puntos acumulados:', 'Points earned:')}{' '}
                    <span className="font-semibold text-foreground">{yo.puntos}</span>
                  </span>
                  {yo.siguienteNivel && (
                    <span className="rounded-full bg-glass px-2.5 py-1 text-xs font-medium text-muted-foreground">
                      {t('Te faltan', 'You need')} <span className="font-semibold text-foreground">{yo.puntosFaltan}</span>{' '}
                      {t('puntos para', 'points to reach')}{' '}
                      <span className="font-semibold text-teal-700 dark:text-teal-300">
                        {dispLang === 'en' ? yo.siguienteNivel.en : yo.siguienteNivel.es}
                      </span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex flex-wrap gap-2">
            {([
              ['semana', 'Junta semanal', Users],
              ['puntos', 'Puntos y niveles', Trophy],
              ['organizar', 'Organizar', CalendarClock],
              ['noticias', 'Noticias', Newspaper],
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
                {t(
                  lbl,
                  id === 'semana' ? 'Weekly meeting' : id === 'puntos' ? 'Points & levels' : id === 'organizar' ? 'Organization' : 'News'
                )}
                {id === 'noticias' && esAdmin && (data?.noticiasPendientes.length ?? 0) > 0 && (
                  <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[11px] font-bold text-white">
                    {data?.noticiasPendientes.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {tab === 'semana' && renderSemana()}
          {tab === 'puntos' && renderPuntos()}
          {tab === 'organizar' && renderOrganizar()}
          {tab === 'noticias' && renderNoticias()}
        </>
      )}

      {/* Modal de perfil publico */}
      {perfilUid && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setPerfilUid(null)}>
          <div className="glass-panel w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-teal-600 text-base font-bold text-white">
                  {(perfilInfo?.nombre || '?').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-foreground">{perfilInfo?.nombre || t('Cargando...', 'Loading...')}</p>
                  {perfilInfo?.nivel && (
                    <p className="text-xs text-muted-foreground">
                      {t('Nivel:', 'Level:')} {dispLang === 'en' ? perfilInfo.nivel.en : perfilInfo.nivel.es}
                    </p>
                  )}
                </div>
              </div>
              <button type="button" onClick={() => setPerfilUid(null)} className="rounded p-1 text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            {perfilInfo && (
              <div className="mt-4 space-y-2 text-sm">
                {perfilInfo.email && <p className="text-muted-foreground">{perfilInfo.email}</p>}
                {perfilInfo.telefono && <p className="text-muted-foreground">{perfilInfo.telefono}</p>}
                {perfilInfo.empresa && <p className="text-muted-foreground">{perfilInfo.empresa}</p>}
                {perfilInfo.certificado && (
                  <p className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                    <Check className="h-3 w-3" /> {t('Miembro certificado MBE', 'Certified MBE member')}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';
import { useDisplayLang } from '@/components/display-lang-provider';
import { useUserRoles } from '@/lib/use-user-roles';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { TEMAS_ESPECIALISTA, TEMA_LABELS, type TemaEspecialista } from '@/lib/roles';
import AgentAvatar from '@/components/agentes/AgentAvatar';
import { BABEL_AYUDA_EVENT } from '@/components/babel/BabelAvatar';
import PageTour, { type TourStep } from '@/components/ui/executive/PageTour';

type TabKey = 'panel' | 'perfil';

const PASOS_TOUR_ESPECIALISTA: Record<'es' | 'en', TourStep[]> = {
  es: [
    {
      selector: '#especialista-title',
      title: 'Panel de Mentor',
      description: 'Aquí ves tu agenda, tus usuarios asignados, tus actividades y tus pagos como mentor.',
    },
    {
      selector: '#especialista-tabs',
      title: 'Pestañas',
      description: '"Mi panel" muestra tus usuarios y actividades. "Perfil y agenda" es donde conectas tu calendario y tus datos bancarios.',
    },
    {
      selector: '#especialista-usuarios',
      title: 'Usuarios en tus temas',
      description: 'Aquí ves el nivel de madurez de cada usuario en los temas que atiendes y cuántos pendientes tiene.',
    },
  ],
  en: [
    {
      selector: '#especialista-title',
      title: 'Mentor Panel',
      description: 'Here you see your calendar, your assigned users, your activities and your payments as a mentor.',
    },
    {
      selector: '#especialista-tabs',
      title: 'Tabs',
      description: '"My panel" shows your users and activities. "Profile & calendar" is where you connect your calendar and bank details.',
    },
    {
      selector: '#especialista-usuarios',
      title: 'Users in your themes',
      description: 'Here you see each user\'s maturity level in the themes you cover and how many pending items they have.',
    },
  ],
};

const NIVEL_ES: Record<string, string> = {
  execution: 'Ejecución',
  standard: 'Estándar',
  control: 'Control',
  optimization: 'Optimización',
  excellence: 'Excelencia',
  influencer: 'Influencer',
};
const NIVEL_EN: Record<string, string> = {
  execution: 'Execution',
  standard: 'Standard',
  control: 'Control',
  optimization: 'Optimization',
  excellence: 'Excellence',
  influencer: 'Influencer',
};

function fmtDate(iso: unknown, lang: 'es' | 'en') {
  if (!iso) return '—';
  const d = new Date(String(iso));
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(lang === 'en' ? 'en-US' : 'es-MX', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function EspecialistaPage() {
  const params = useParams();
  const routeLocale = typeof params.locale === 'string' ? params.locale : 'es';
  const router = useRouter();
  const { lang } = useDisplayLang();
  const [dispLang, setDispLang] = React.useState<'es' | 'en'>(routeLocale === 'en' ? 'en' : 'es');
  React.useEffect(() => { setDispLang(lang); }, [lang]);
  const t = (es: string, en: string) => (dispLang === 'en' ? en : es);

  const { loading, especialista } = useUserRoles();
  const [user, setUser] = React.useState<User | null>(null);
  const [tab, setTab] = React.useState<TabKey>('panel');

  const [panel, setPanel] = React.useState<{
    perfil: {
      nombre?: string;
      email?: string;
      temas?: TemaEspecialista[];
      temasLabels?: string[];
      agenda?: { plataforma: string; link: string; usuario: string } | null;
      banco?: { clabe?: string; banco?: string; titular?: string; email?: string } | null;
    };
    usuarios: {
      uid: string;
      nombre: string;
      email: string;
      temas: { id: string; nivel: string; nivelEn: string; nextStep: string }[];
      planAccionPendientes: number;
      madurezPendientes: number;
    }[];
    actividades: any[];
    pagosRecibidos: any[];
  } | null>(null);

  // Perfil: agenda + banco
  const [agendaPlataforma, setAgendaPlataforma] = React.useState<'calendly' | 'google'>('calendly');
  const [agendaLink, setAgendaLink] = React.useState('');
  const [agendaUsuario, setAgendaUsuario] = React.useState('');
  const [bancoClabe, setBancoClabe] = React.useState('');
  const [bancoBanco, setBancoBanco] = React.useState('');
  const [bancoTitular, setBancoTitular] = React.useState('');
  const [bancoEmail, setBancoEmail] = React.useState('');
  const [perfilMsg, setPerfilMsg] = React.useState('');

  // Nueva actividad
  const [actForm, setActForm] = React.useState({ usuarioUid: '', usuarioNombre: '', tema: '', tipo: 'reunion', descripcion: '', fecha: '' });
  const [actMsg, setActMsg] = React.useState('');

  React.useEffect(() => {
    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return unsub;
  }, []);

  const loadPanel = React.useCallback(async () => {
    if (!user) return;
    const token = await user.getIdToken();
    const res = await fetch('/api/especialista/panel', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const data = await res.json();
    setPanel(data);
    // Hidratar el formulario de perfil
    if (data?.perfil?.agenda) {
      setAgendaPlataforma(data.perfil.agenda.plataforma === 'google' ? 'google' : 'calendly');
      setAgendaLink(data.perfil.agenda.link ?? '');
      setAgendaUsuario(data.perfil.agenda.usuario ?? '');
    }
    if (data?.perfil?.banco) {
      setBancoClabe(data.perfil.banco.clabe ?? '');
      setBancoBanco(data.perfil.banco.banco ?? '');
      setBancoTitular(data.perfil.banco.titular ?? '');
      setBancoEmail(data.perfil.banco.email ?? '');
    }
  }, [user]);

  React.useEffect(() => {
    if (especialista && user) loadPanel().catch(() => {});
  }, [especialista, user, loadPanel]);

  async function savePerfil() {
    if (!user) return;
    const token = await user.getIdToken();
    const res = await fetch('/api/especialista/panel', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agenda: {
          plataforma: agendaPlataforma,
          link: agendaLink.trim(),
          usuario: agendaUsuario.trim(),
        },
        banco: {
          clabe: bancoClabe.trim(),
          banco: bancoBanco.trim(),
          titular: bancoTitular.trim(),
          email: bancoEmail.trim(),
        },
      }),
    });
    if (!res.ok) {
      setPerfilMsg(t('No se pudo guardar el perfil.', 'Could not save the profile.'));
      return;
    }
    setPerfilMsg(t('Perfil guardado.', 'Profile saved.'));
  }

  async function saveActividad() {
    if (!user) return;
    const token = await user.getIdToken();
    const res = await fetch('/api/especialista/actividad', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usuarioUid: actForm.usuarioUid,
        usuarioNombre: actForm.usuarioNombre,
        tema: actForm.tema,
        tipo: actForm.tipo,
        descripcion: actForm.descripcion,
        fecha: actForm.fecha || new Date().toISOString(),
      }),
    });
    if (!res.ok) {
      setActMsg(t('No se pudo registrar la actividad.', 'Could not register the activity.'));
      return;
    }
    setActMsg(t('Actividad registrada.', 'Activity registered.'));
    setActForm({ usuarioUid: '', usuarioNombre: '', tema: '', tipo: 'reunion', descripcion: '', fecha: '' });
    await loadPanel();
  }

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">{t('Cargando...', 'Loading...')}</div>;
  }
  if (!especialista) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-10 text-center">
        <h1 className="text-xl font-semibold">{t('Panel de Mentor', 'Mentor Panel')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('No tienes rol de mentor.', 'You do not have a mentor role.')}
        </p>
        <Button type="button" variant="outline" onClick={() => router.push(`/${routeLocale}/inicio`)}>
          {t('Ir al inicio', 'Go home')}
        </Button>
      </div>
    );
  }

  const perfil = panel?.perfil;
  const usuarios = panel?.usuarios ?? [];
  const actividades = panel?.actividades ?? [];
  const pagosRecibidos = panel?.pagosRecibidos ?? [];
  const misTemas = perfil?.temas ?? [];

  return (
    <div className="px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-start gap-3">
          <AgentAvatar
            agente="Babel"
            size={48}
            className="mt-0.5 shrink-0"
            onClick={() => window.dispatchEvent(new CustomEvent(BABEL_AYUDA_EVENT))}
          />
          <div>
            <h1 id="especialista-title" className="text-xl font-semibold text-foreground">{t('Panel de Mentor', 'Mentor Panel')}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('Agenda, usuarios por tema, actividades y pagos.', 'Calendar, users per theme, activities and payments.')}
            </p>
          </div>
        </div>

        <div id="especialista-tabs" className="flex flex-wrap gap-2">
          <Button type="button" variant={tab === 'panel' ? 'default' : 'outline'} size="sm" onClick={() => setTab('panel')}>
            {t('Mi panel', 'My panel')}
          </Button>
          <Button type="button" variant={tab === 'perfil' ? 'default' : 'outline'} size="sm" onClick={() => setTab('perfil')}>
            {t('Perfil y agenda', 'Profile & calendar')}
          </Button>
        </div>

        {tab === 'perfil' && (
          <div className="space-y-6">
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <h2 className="text-sm font-semibold text-foreground">{t('Mi agenda de reuniones', 'My meeting calendar')}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t('Conecta un calendario para que los usuarios agenden reuniones virtuales en tus temas. Recomendado: Calendly (gratis) — crea tu cuenta en calendly.com, copia tu link (ej. https://calendly.com/tu-usuario) y pégalo aquí. También puedes usar Google Calendar.', 'Connect a calendar so users can book virtual meetings in your themes. Recommended: Calendly (free) — create your account at calendly.com, copy your link (e.g. https://calendly.com/your-user) and paste it here. Google Calendar also works.')}
              </p>
              <div className="mt-4 space-y-3">
                <div className="space-y-1">
                  <Label>{t('Plataforma', 'Platform')}</Label>
                  <Select
                    value={agendaPlataforma}
                    onChange={(e) => setAgendaPlataforma(e.target.value as 'calendly' | 'google')}
                  >
                    <option value="calendly">Calendly</option>
                    <option value="google">Google Calendar</option>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>{t('Link de agendamiento', 'Booking link')}</Label>
                  <Input
                    placeholder={agendaPlataforma === 'calendly' ? 'https://calendly.com/tu-usuario' : 'https://calendar.google.com/calendar/u/0/selfsched?sstoken=...'}
                    value={agendaLink}
                    onChange={(e) => setAgendaLink(e.target.value)}
                  />
                </div>
                {agendaPlataforma === 'google' && (
                  <div className="space-y-1">
                    <Label>{t('Usuario de Google (opcional)', 'Google user (optional)')}</Label>
                    <Input placeholder="tucorreo@gmail.com" value={agendaUsuario} onChange={(e) => setAgendaUsuario(e.target.value)} />
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <h2 className="text-sm font-semibold text-foreground">{t('Datos bancarios para recibir pagos', 'Bank details to receive payments')}</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>{t('Titular de la cuenta', 'Account holder')}</Label>
                  <Input value={bancoTitular} onChange={(e) => setBancoTitular(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>{t('Banco', 'Bank')}</Label>
                  <Input value={bancoBanco} onChange={(e) => setBancoBanco(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>{t('CLABE (México)', 'CLABE (Mexico)')}</Label>
                  <Input value={bancoClabe} onChange={(e) => setBancoClabe(e.target.value)} placeholder="000000000000000000" />
                </div>
                <div className="space-y-1">
                  <Label>{t('Correo de pago', 'Payment email')}</Label>
                  <Input value={bancoEmail} onChange={(e) => setBancoEmail(e.target.value)} />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <Button type="button" onClick={savePerfil}>
                  {t('Guardar perfil', 'Save profile')}
                </Button>
                {perfilMsg && <p className="text-sm text-emerald-700">{perfilMsg}</p>}
              </div>
            </div>
          </div>
        )}

        {tab === 'panel' && (
          <div className="space-y-6">
            <div className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <InfoChip label={t('Mis temas', 'My themes')} value={misTemas.map((tm) => TEMA_LABELS[tm][dispLang === 'en' ? 'en' : 'es']).join(', ') || '—'} />
              <InfoChip label={t('Usuarios en mis temas', 'Users in my themes')} value={String(usuarios.length)} />
              <InfoChip label={t('Actividades realizadas', 'Activities done')} value={String(actividades.length)} />
              <InfoChip label={t('Pagos recibidos', 'Payments received')} value={String(pagosRecibidos.length)} />
            </div>

            <div id="especialista-usuarios">
              <h2 className="text-sm font-semibold text-foreground">{t('Usuarios y su nivel de madurez en mis temas', 'Users and their maturity level in my themes')}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t('Los pendientes de madurez y de plan de acción se sincronizan cuando el usuario trabaja sus secciones.', 'Maturity and action plan pending items sync when the user works on their sections.')}
              </p>
              <div className="mt-3 max-h-[460px] overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-300">
                    <tr>
                      <th className="px-3 py-2 font-medium">{t('Usuario', 'User')}</th>
                      <th className="px-3 py-2 font-medium">{t('Tema', 'Theme')}</th>
                      <th className="px-3 py-2 font-medium">{t('Nivel', 'Level')}</th>
                      <th className="px-3 py-2 font-medium">{t('Siguiente paso', 'Next step')}</th>
                      <th className="px-3 py-2 font-medium">{t('Pendientes', 'Pending')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usuarios.flatMap((u) =>
                      u.temas.map((tema) => (
                        <tr key={u.uid + '-' + tema.id} className="border-t border-slate-100 dark:border-slate-800">
                          <td className="px-3 py-2">
                            <div className="font-medium text-foreground">{u.nombre || '—'}</div>
                            <div className="text-xs text-muted-foreground">{u.email}</div>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {TEMA_LABELS[tema.id as keyof typeof TEMA_LABELS]?.[dispLang === 'en' ? 'en' : 'es'] ?? tema.id}
                          </td>
                          <td className="px-3 py-2">
                            <span className="rounded-full bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-800 dark:bg-teal-500/20 dark:text-teal-200">
                              {(dispLang === 'en' ? NIVEL_EN : NIVEL_ES)[tema.nivel] ?? tema.nivel}
                            </span>
                          </td>
                          <td className="max-w-[260px] px-3 py-2 text-xs text-muted-foreground">{tema.nextStep || '—'}</td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">
                            <span className="font-medium text-amber-700 dark:text-amber-300">{u.madurezPendientes}</span> {t('madurez', 'maturity')}
                            {' · '}
                            <span className="font-medium text-indigo-700 dark:text-indigo-300">{u.planAccionPendientes}</span> {t('plan de acción', 'action plan')}
                          </td>
                        </tr>
                      ))
                    )}
                    {usuarios.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-3 py-8 text-center text-sm text-muted-foreground">
                          {t('Aún no hay usuarios con evaluación en tus temas.', 'No users with assessments in your themes yet.')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
              <h2 className="text-sm font-semibold text-foreground">{t('Registrar actividad realizada', 'Register completed activity')}</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Select
                  value={actForm.usuarioUid}
                  onChange={(e) => {
                    const u = usuarios.find((x) => x.uid === e.target.value);
                    setActForm((f) => ({ ...f, usuarioUid: e.target.value, usuarioNombre: u?.nombre ?? '' }));
                  }}
                >
                  <option value="">{t('Usuario atendido', 'User served')}</option>
                  {usuarios.map((u) => (
                    <option key={u.uid} value={u.uid}>
                      {u.nombre || u.email || u.uid}
                    </option>
                  ))}
                </Select>
                <Select
                  value={actForm.tema}
                  onChange={(e) => setActForm((f) => ({ ...f, tema: e.target.value }))}
                >
                  <option value="">{t('Tema', 'Theme')}</option>
                  {misTemas.map((tm) => (
                    <option key={tm} value={tm}>
                      {TEMA_LABELS[tm][dispLang === 'en' ? 'en' : 'es']}
                    </option>
                  ))}
                </Select>
                <Select
                  value={actForm.tipo}
                  onChange={(e) => setActForm((f) => ({ ...f, tipo: e.target.value }))}
                >
                  <option value="reunion">{t('Reunión de asesoría', 'Advisory meeting')}</option>
                  <option value="capacitacion">{t('Capacitación', 'Training')}</option>
                  <option value="revision">{t('Revisión de avance', 'Progress review')}</option>
                  <option value="otra">{t('Otra', 'Other')}</option>
                </Select>
                <div className="space-y-1 lg:col-span-2">
                  <Input
                    placeholder={t('Descripción de la actividad', 'Activity description')}
                    value={actForm.descripcion}
                    onChange={(e) => setActForm((f) => ({ ...f, descripcion: e.target.value }))}
                  />
                </div>
                <Button type="button" onClick={saveActividad}>
                  {t('Registrar', 'Register')}
                </Button>
              </div>
              {actMsg && <p className="mt-2 text-sm text-emerald-700">{actMsg}</p>}
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <h2 className="text-sm font-semibold text-foreground">{t('Actividades realizadas', 'Activities done')}</h2>
                <div className="mt-3 max-h-[320px] overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-300">
                      <tr>
                        <th className="px-3 py-2 font-medium">{t('Fecha', 'Date')}</th>
                        <th className="px-3 py-2 font-medium">{t('Usuario', 'User')}</th>
                        <th className="px-3 py-2 font-medium">{t('Tema', 'Theme')}</th>
                        <th className="px-3 py-2 font-medium">{t('Descripción', 'Description')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {actividades.map((a) => (
                        <tr key={a.id} className="border-t border-slate-100 dark:border-slate-800">
                          <td className="px-3 py-2 text-xs text-muted-foreground">{fmtDate(a.fecha ?? a.createdAt, dispLang)}</td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">
                            {(() => {
                              const ua = usuarios.find((x) => x.uid === a.usuarioUid);
                              return a.usuarioNombre || ua?.nombre || ua?.email || '—';
                            })()}
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">
                            {TEMA_LABELS[a.tema as keyof typeof TEMA_LABELS]?.[dispLang === 'en' ? 'en' : 'es'] ?? a.tema ?? '—'}
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">{a.descripcion}</td>
                        </tr>
                      ))}
                      {actividades.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-3 py-6 text-center text-sm text-muted-foreground">
                            {t('Sin actividades todavía.', 'No activities yet.')}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h2 className="text-sm font-semibold text-foreground">{t('Pagos recibidos', 'Payments received')}</h2>
                <div className="mt-3 max-h-[320px] overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-300">
                      <tr>
                        <th className="px-3 py-2 font-medium">{t('Fecha', 'Date')}</th>
                        <th className="px-3 py-2 font-medium">{t('Monto', 'Amount')}</th>
                        <th className="px-3 py-2 font-medium">{t('Concepto', 'Concept')}</th>
                        <th className="px-3 py-2 font-medium">{t('Método', 'Method')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagosRecibidos.map((p) => (
                        <tr key={p.id} className="border-t border-slate-100 dark:border-slate-800">
                          <td className="px-3 py-2 text-xs text-muted-foreground">{fmtDate(p.fechaPago ?? p.createdAt, dispLang)}</td>
                          <td className="px-3 py-2 font-medium text-emerald-700 dark:text-emerald-300">
                            {p.monto == null ? '—' : 'MX$ ' + Number(p.monto).toLocaleString('en-US')}
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">{p.concepto ?? '—'}</td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">{p.metodo ?? '—'}</td>
                        </tr>
                      ))}
                      {pagosRecibidos.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-3 py-6 text-center text-sm text-muted-foreground">
                            {t('Sin pagos todavía.', 'No payments yet.')}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        <PageTour
          pageId="especialista"
          steps={dispLang === 'en' ? PASOS_TOUR_ESPECIALISTA.en : PASOS_TOUR_ESPECIALISTA.es}
          lang={dispLang}
        />
      </div>
    </div>
  );
}

function InfoChip({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}
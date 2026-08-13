'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';
import { useDisplayLang } from '@/components/display-lang-provider';
import { CalendarDays, ChevronDown, ExternalLink, Loader2 } from 'lucide-react';
import type { User } from 'firebase/auth';

interface EspecialistaPublico {
  uid: string;
  nombre: string;
  email: string;
  temas: { id: string; label: string }[];
  agenda: { plataforma: string; link: string; usuario: string };
}

function bookingHref(e: EspecialistaPublico): string {
  if (!e.agenda) return '';
  if (e.agenda.plataforma === 'google') {
    if (e.agenda.link) return e.agenda.link;
    if (e.agenda.usuario) return 'https://calendar.google.com/calendar/u/0/r';
    return '';
  }
  return e.agenda.link || '';
}

interface Area {
  id: string;
  temaId: string;
  titulo: { es: string; en: string };
  explicacion: { es: string; en: string };
}

const AREAS: Area[] = [
  {
    id: 'convocatorias',
    temaId: 'convocatorias_certificacion',
    titulo: { es: 'Convocatorias', en: 'Grants & Calls' },
    explicacion: {
      es: 'Te ayuda a encontrar la convocatoria apta para tu giro y te apoya a aplicar y ganarla.',
      en: 'Helps you find the right grant for your business and supports you to apply and win it.',
    },
  },
  {
    id: 'certificacion',
    temaId: 'convocatorias_certificacion',
    titulo: { es: 'Certificación', en: 'Certification' },
    explicacion: {
      es: 'Evalúa tu empresa en diversos rubros para certificarla, lo que te permitirá que te refieran con grandes empresas e inversionistas.',
      en: 'Assesses your company across several areas to certify it, so you can get referrals from big companies and investors.',
    },
  },
  {
    id: 'rumbo_estrategico',
    temaId: 'rumbo_estrategico',
    titulo: { es: 'Rumbo Estratégico', en: 'Strategic Direction' },
    explicacion: {
      es: 'Te da mentoría, colaboración y/o te entrega herramientas para definir y administrar tu estrategia.',
      en: 'Provides mentorship, collaboration and/or tools to define and manage your strategy.',
    },
  },
  {
    id: 'finanzas',
    temaId: 'finanzas',
    titulo: { es: 'Finanzas', en: 'Finance' },
    explicacion: {
      es: 'Te da mentoría, colabora y/o te entrega herramientas para planear y administrar tu dinero.',
      en: 'Provides mentorship, collaboration and/or tools to plan and manage your money.',
    },
  },
  {
    id: 'marketing_ventas',
    temaId: 'marketing_ventas',
    titulo: { es: 'Marketing y Ventas', en: 'Marketing & Sales' },
    explicacion: {
      es: 'Te da mentoría, colabora y/o te entrega herramientas para incrementar tus ventas y posicionar tu negocio.',
      en: 'Provides mentorship, collaboration and/or tools to increase your sales and position your business.',
    },
  },
  {
    id: 'atencion_cliente',
    temaId: 'atencion_cliente',
    titulo: { es: 'Atención al Cliente', en: 'Customer Service' },
    explicacion: {
      es: 'Te da mentoría, colabora y/o te entrega herramientas para mejorar la experiencia y fidelización de tus clientes.',
      en: 'Provides mentorship, collaboration and/or tools to improve your customers experience and loyalty.',
    },
  },
  {
    id: 'cumplimiento_legal',
    temaId: 'cumplimiento_legal',
    titulo: { es: 'Cumplimiento Normativo Legal', en: 'Legal Compliance' },
    explicacion: {
      es: 'Te da mentoría, colabora y/o te entrega herramientas para reducir riesgos legales.',
      en: 'Provides mentorship, collaboration and/or tools to reduce legal risks.',
    },
  },
  {
    id: 'cumplimiento_fiscal',
    temaId: 'cumplimiento_fiscal',
    titulo: { es: 'Cumplimiento Normativo Fiscal', en: 'Tax Compliance' },
    explicacion: {
      es: 'Te da mentoría, colabora y/o te entrega herramientas para reducir riesgos fiscales.',
      en: 'Provides mentorship, collaboration and/or tools to reduce tax risks.',
    },
  },
  {
    id: 'operacion',
    temaId: 'operacion',
    titulo: { es: 'Operación', en: 'Operations' },
    explicacion: {
      es: 'Te da mentoría, colabora y/o te entrega herramientas para incrementar tu productividad y entregar mejor tu producto o servicio.',
      en: 'Provides mentorship, collaboration and/or tools to increase your productivity and deliver your product or service better.',
    },
  },
  {
    id: 'conocimiento',
    temaId: 'conocimiento',
    titulo: { es: 'Conocimiento', en: 'Knowledge' },
    explicacion: {
      es: 'Te da mentoría, colabora y/o te entrega herramientas para digitalizar y mejorar tu información y toma de decisiones.',
      en: 'Provides mentorship, collaboration and/or tools to digitize and improve your information and decision-making.',
    },
  },
  {
    id: 'alianzas',
    temaId: 'alianzas',
    titulo: { es: 'Alianzas', en: 'Alliances' },
    explicacion: {
      es: 'Te da mentoría, colabora y/o te entrega herramientas para crear ecosistemas de tu giro.',
      en: 'Provides mentorship, collaboration and/or tools to build ecosystems in your industry.',
    },
  },
  {
    id: 'socioambiental',
    temaId: 'socioambiental',
    titulo: { es: 'Enfoque SocioAmbiental', en: 'Socio-Environmental Focus' },
    explicacion: {
      es: 'Te da mentoría, colabora y/o te entrega herramientas para tener ventajas competitivas socioambientales.',
      en: 'Provides mentorship, collaboration and/or tools to gain socio-environmental competitive advantages.',
    },
  },
  {
    id: 'capital_humano',
    temaId: 'capital_humano',
    titulo: { es: 'Capital Humano', en: 'Human Capital' },
    explicacion: {
      es: 'Te da mentoría, colabora y/o te entrega herramientas para seleccionar y desarrollar a tus colaboradores.',
      en: 'Provides mentorship, collaboration and/or tools to select and develop your team.',
    },
  },
  {
    id: 'cultura',
    temaId: 'cultura',
    titulo: { es: 'Cultura Organizacional', en: 'Organizational Culture' },
    explicacion: {
      es: 'Te da mentoría, colabora y/o te entrega herramientas para desarrollar la cultura de trabajo que necesita tu empresa.',
      en: 'Provides mentorship, collaboration and/or tools to build the work culture your company needs.',
    },
  },
];

export default function AgendarPage() {
  const params = useParams();
  const routeLocale = typeof params.locale === 'string' ? params.locale : 'es';
  const { lang } = useDisplayLang();
  const [dispLang, setDispLang] = React.useState<'es' | 'en'>(routeLocale === 'en' ? 'en' : 'es');
  React.useEffect(() => { setDispLang(lang); }, [lang]);
  const t = (es: string, en: string) => (dispLang === 'en' ? en : es);

  const [especialistas, setEspecialistas] = React.useState<EspecialistaPublico[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [abierto, setAbierto] = React.useState<string | null>(null);
  const [temaSeleccionado, setTemaSeleccionado] = React.useState('');
  const [user, setUser] = React.useState<User | null>(null);
  const [payLoading, setPayLoading] = React.useState<string | null>(null);
  const [payError, setPayError] = React.useState('');

  async function handlePagar(productId: string) {
    if (!user) {
      setPayError(t('Inicia sesión para contratar.', 'Log in to purchase.'));
      return;
    }
    setPayLoading(productId);
    setPayError('');
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/pagos/crear-preferencia', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ locale: dispLang, returnPath: '/perfil', productId }),
      });
      const data = await res.json();
      if (!res.ok || !data.checkoutUrl) {
        throw new Error(data.error || 'pago fallido');
      }
      window.location.href = data.checkoutUrl;
    } catch (err) {
      console.error('[agendar] pago fallido', err);
      setPayError(
        t(
          'No se pudo iniciar el pago. Intenta de nuevo en unos segundos.',
          'Could not start the payment. Try again in a few seconds.'
        )
      );
      setPayLoading(null);
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
        .then(async (token) => {
          const res = await fetch('/api/especialistas', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) throw new Error('load failed');
          const data = await res.json();
          if (!cancelled && Array.isArray(data.especialistas)) setEspecialistas(data.especialistas);
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  const mentoresDe = (area: Area) =>
    especialistas.filter((e) => e.temas.some((tm) => tm.id === area.temaId));

  const toggle = (id: string) => setAbierto((prev) => (prev === id ? null : id));

  const areaSeleccionada = AREAS.find((a) => a.id === temaSeleccionado);

  const renderDetalleArea = (area: Area) => {
    const mentores = mentoresDe(area);
    const open = abierto === area.id;
    return (
      <div>
        <h2 className="font-semibold text-foreground">
          {area.titulo.es === area.titulo.en ? area.titulo.es : area.titulo[dispLang]}
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{area.explicacion[dispLang]}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t(
            `${mentores.length} mentor${mentores.length === 1 ? '' : 'es'} disponible${mentores.length === 1 ? '' : 's'} para este tema.`,
            `${mentores.length} mentor${mentores.length === 1 ? '' : 's'} available for this topic.`
          )}
        </p>
        <div className="mt-3 flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <button
            type="button"
            onClick={() => toggle(area.id)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-700"
          >
            {t('Agenda Cita de orientacion GRATIS', 'Book FREE orientation session')}
            <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
          {area.id === 'certificacion' ? (
            <button
              type="button"
              onClick={() => handlePagar('certificacion_mbe')}
              disabled={payLoading !== null}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-teal-600 bg-transparent px-4 py-2 text-sm font-semibold text-teal-700 transition-colors hover:bg-teal-50 disabled:opacity-60 dark:text-teal-300 dark:hover:bg-teal-500/10"
            >
              {payLoading === 'certificacion_mbe' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4" />
              )}
              {t('Contratar Certificacion Anual', 'Purchase Annual Certification')}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => handlePagar('apoyo_ondemand')}
                disabled={payLoading !== null}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-teal-600 bg-transparent px-4 py-2 text-sm font-semibold text-teal-700 transition-colors hover:bg-teal-50 disabled:opacity-60 dark:text-teal-300 dark:hover:bg-teal-500/10"
              >
                {payLoading === 'apoyo_ondemand' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4" />
                )}
                {t('Contratar Apoyo On Demand (1 entregable)', 'Purchase On-Demand Support (1 deliverable)')}
              </button>
              <button
                type="button"
                onClick={() => handlePagar('paquete_especialista')}
                disabled={payLoading !== null}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-teal-600 bg-transparent px-4 py-2 text-sm font-semibold text-teal-700 transition-colors hover:bg-teal-50 disabled:opacity-60 dark:text-teal-300 dark:hover:bg-teal-500/10"
              >
                {payLoading === 'paquete_especialista' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4" />
                )}
                {t('Contratar Paquete Mentor (Hasta 4 entregables)', 'Purchase Mentor Package (Up to 4 deliverables)')}
              </button>
            </>
          )}
        </div>
        {payError && <p className="mt-2 text-xs text-red-600">{payError}</p>}
        {open && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {mentores.map((e) => (
              <a
                key={e.uid}
                href={bookingHref(e)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-teal-600 px-3 py-1.5 text-xs font-medium text-teal-700 transition-colors hover:bg-teal-50 dark:text-teal-300 dark:hover:bg-teal-500/10"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {e.nombre || t('Mentor', 'Mentor')}
              </a>
            ))}
            {mentores.length === 0 && (
              <span className="text-xs text-muted-foreground">
                {t('Proximamente habra mentores para este tema.', 'Mentors for this topic coming soon.')}
              </span>
            )}
          </div>
        )}
        {open && (
          <div className="mt-3 border-t pt-3" style={{ borderColor: 'var(--glass-border)' }}>
            <p className="text-xs font-medium text-foreground">
              {t('Calendarios de los mentores de este tema', 'Mentors calendars for this topic')}
            </p>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {mentores.map((e) => (
                <div key={e.uid} className="glass-panel flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {e.nombre || t('Mentor', 'Mentor')}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{e.email}</p>
                  </div>
                  {bookingHref(e) ? (
                    <a
                      href={bookingHref(e)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-teal-700"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      {t('Abrir calendario', 'Open calendar')}
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {t('Sin agenda configurada', 'No calendar set up')}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            {t('Agenda con un mentor', 'Schedule a meeting with a mentor')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(
              'Elige el tema que tu empresa necesita y agenda una cita de orientacion GRATIS con un mentor de nivel directivo.',
              'Pick the topic your company needs and book a FREE orientation session with a director-level mentor.'
            )}
          </p>
        </div>

        {loading && (
          <div className="flex min-h-[30vh] items-center justify-center text-sm text-muted-foreground">
            {t('Cargando...', 'Loading...')}
          </div>
        )}

        {!loading && especialistas.length === 0 && (
          <div className="glass-panel p-10 text-center">
            <CalendarDays className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="mt-3 text-sm text-muted-foreground">
              {t('Todavia no hay mentores con agenda configurada.', 'There are no mentors with a calendar set up yet.')}
            </p>
          </div>
        )}

        {!loading && especialistas.length > 0 && (
          <div className="glass-panel p-5">
            <label className="mb-1.5 block text-sm font-medium text-foreground" htmlFor="agendar-tema-select">
              {t('1. Elige el tema en el que necesitas apoyo', '1. Choose the topic you need support with')}
            </label>
            <select
              id="agendar-tema-select"
              value={temaSeleccionado}
              onChange={(ev) => {
                setTemaSeleccionado(ev.target.value);
                setAbierto(null);
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-foreground dark:bg-transparent"
            >
              <option value="">{t('-- Selecciona un tema --', '-- Select a topic --')}</option>
              {AREAS.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.titulo.es === area.titulo.en ? area.titulo.es : area.titulo[dispLang]}
                </option>
              ))}
            </select>

            {areaSeleccionada ? (
              <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--glass-border)' }}>
                {renderDetalleArea(areaSeleccionada)}
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                {t(
                  '2. Al elegir un tema veras aqui como agendar tu cita gratis o contratar apoyo para ese tema.',
                  '2. Once you pick a topic, you will see how to book your free session or hire support for it.'
                )}
              </p>
            )}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          {t('Eres mentor? Configura tu agenda y datos bancarios desde tu seccion "Panel de Mentor".', 'Are you a mentor? Set up your calendar and bank details in your "Mentor Panel" section.')}
        </p>
      </div>
    </div>
  );
}

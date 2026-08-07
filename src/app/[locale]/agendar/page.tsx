'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';
import { useDisplayLang } from '@/components/display-lang-provider';
import { CalendarDays, ExternalLink } from 'lucide-react';

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

export default function AgendarPage() {
  const params = useParams();
  const routeLocale = typeof params.locale === 'string' ? params.locale : 'es';
  const { lang } = useDisplayLang();
  const [dispLang, setDispLang] = React.useState<'es' | 'en'>(routeLocale === 'en' ? 'en' : 'es');
  React.useEffect(() => { setDispLang(lang); }, [lang]);
  const t = (es: string, en: string) => (dispLang === 'en' ? en : es);

  const [especialistas, setEspecialistas] = React.useState<EspecialistaPublico[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        if (!cancelled) setLoading(false);
        return;
      }
      void user
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

  return (
    <div className="px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t('Agenda con un mentor', 'Schedule a meeting with a mentor')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('Elige un mentor y agenda una reunión virtual en el tema que necesitas. Los botones abren su plataforma de agendamiento (Calendly o Google Calendar).', 'Pick a mentor and book a virtual meeting in the theme you need. The buttons open their booking platform (Calendly or Google Calendar).')}
          </p>
        </div>

        {loading && (
          <div className="flex min-h-[30vh] items-center justify-center text-sm text-muted-foreground">{t('Cargando...', 'Loading...')}</div>
        )}

        {!loading && especialistas.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
            <CalendarDays className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="mt-3 text-sm text-muted-foreground">
              {t('Todavía no hay mentores con agenda configurada.', 'There are no mentors with a calendar set up yet.')}
            </p>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {especialistas.map((e) => (
            <div
              key={e.uid}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-foreground">{e.nombre || t('Mentor', 'Mentor')}</h2>
                  <p className="text-xs text-muted-foreground">{e.email}</p>
                </div>
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-200">
                  {t('Mentor', 'Mentor')}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {e.temas.map((tm) => (
                  <span
                    key={tm.id}
                    className="rounded-full border border-slate-200 px-2 py-0.5 text-xs text-muted-foreground dark:border-slate-700"
                  >
                    {tm.label}
                  </span>
                ))}
                {e.temas.length === 0 && (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </div>
              <div className="mt-4">
                {bookingHref(e) ? (
                  <a
                    href={bookingHref(e)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700"
                  >
                    <ExternalLink className="h-4 w-4" />
                    {t('Agendar reunión', 'Book a meeting')}
                  </a>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {t('Este mentor aún no configura su agenda. Vuelve más tarde.', 'This mentor has not set up a calendar yet. Come back later.')}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          {t('¿Eres mentor? Configura tu agenda y datos bancarios desde tu sección "Panel de Mentor".', 'Are you a mentor? Set up your calendar and bank details in your "Mentor Panel" section.')}
        </p>
      </div>
    </div>
  );
}
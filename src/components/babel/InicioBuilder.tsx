'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Bot, Coins, UsersRound } from 'lucide-react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { getFirebaseAuth, getFirebaseDb } from '@/lib/firebase';
import AgentAvatar, { type AgenteAvatarId } from '@/components/agentes/AgentAvatar';
import PageTour, { type TourStep } from '@/components/ui/executive/PageTour';
import { WorldMap, PUNTOS_RECORRIDO, type PuntoRecorrido } from '@/components/worlds/WorldMap';
import { MUNDOS_PREMIUM_LABELS } from '@/lib/worlds';

type InicioLang = 'es' | 'en';
type Params = readonly [string, string];

const T = (lang: InicioLang) => (p: Params) => (lang === 'en' ? p[1] : p[0]);

type CorpiloteInfo = {
  agente: AgenteAvatarId;
  temas: Params;
  rasgo: Params;
};

// Orden oficial del usuario: Babel, Fisnando, Karmetin, Normau, Atech.
const CORPILOTES: CorpiloteInfo[] = [
  {
    agente: 'Babel',
    temas: ['Estrategia | Gente | Cultura', 'Strategy | People | Culture'],
    rasgo: ['Te diferencía y cambia tu entorno', 'Differentiates you and changes your world'],
  },
  {
    agente: 'Fisnando',
    temas: ['Finanzas | Fiscal', 'Finance | Tax'],
    rasgo: ['Te invierte y consigue dinero', 'Invests in you and gets you money'],
  },
  {
    agente: 'Karmetin',
    temas: ['Marketing | Ventas | Atención al Cliente', 'Marketing | Sales | Customer Service'],
    rasgo: ['Te atrae y retiene clientes', 'Attracts and retains customers'],
  },
  {
    agente: 'Normau',
    temas: ['Normas | Alianzas | Socioambiental', 'Rules | Alliances | Socio-environmental'],
    rasgo: ['Te protege del entorno', 'Protects you from the environment'],
  },
  {
    agente: 'Atech',
    temas: ['Operación | Conocimiento', 'Operations | Knowledge'],
    rasgo: ['Te estructura y facilita decisiones', 'Structures you and eases decisions'],
  },
];

const MUNDOS_ACCESO = [
  {
    id: 'partida',
    icono: '🎓',
    titulo: ['Mundo de Partida', 'Starting World'] as Params,
    desc: [
      'Anfitrión Babel · 5 misiones para calibrar tu empresa antes de la aventura. Al completarlas desbloqueas el Tablero de Retos.',
      'Hosted by Babel · 5 missions to calibrate your company before the adventure. Completing them unlocks the Challenges Board.',
    ] as Params,
    v: 'partida',
  },
  {
    id: 'tablero',
    icono: '🎯',
    titulo: ['Tablero de Retos', 'Challenges Board'] as Params,
    desc: [
      'Retos semanales y mensuales sobre tus 11 temas de madurez. Se desbloquea terminando el Mundo de Partida.',
      'Weekly and monthly challenges over your 11 maturity topics. Unlocks by finishing the Starting World.',
    ] as Params,
    v: 'tablero',
  },
  {
    id: 'estrategia',
    icono: '🧭',
    titulo: ['Mundo de la Estrategia', 'Strategy World'] as Params,
    desc: [
      'El motor de tu empresa: cada submundo se alimenta de tu Reflexión Estratégica y tu Plan de Acción.',
      'The engine of your company: every subworld is fed by your Strategic Reflection and Action Plan.',
    ] as Params,
    v: 'estrategia',
  },
];

const PASOS_TOUR: Record<InicioLang, TourStep[]> = {
  es: [
    { selector: '#inicio-title', title: 'Inicio', description: '¡Hola! Aquí empieza tu viaje con MBE: nosotros transformamos tu empresa y tú el mundo.' },
    { selector: '#inicio-agentes', title: 'Tus Corpilotos de IA', description: 'Conoce a los 5 agentes que te ayudarán a recorrer varios mundos empresariales. Pasa el cursor sobre su imagen para verla en grande.' },
    { selector: '#inicio-mundos', title: 'El universo MBE', description: 'Viaja por el universo empresarial de MBE Corp: cada mundo te conecta con tu equipo de especialistas, herramientas, mentoría y nuevas formas de hacer dinero.' },
  ],
  en: [
    { selector: '#inicio-title', title: 'Home', description: 'Hi! Your journey with MBE starts here: we transform your company and you transform the world.' },
    { selector: '#inicio-agentes', title: 'Your AI Copilots', description: 'Meet the 5 AI agents who will help you explore several business worlds. Hover their image to view it big.' },
    { selector: '#inicio-mundos', title: 'The MBE universe', description: 'Travel across the business universe of MBE Corp: every world connects you with your specialist team, tools and new ways to make money.' },
  ],
};

export default function InicioBuilder({ lang }: { lang: InicioLang }) {
  const router = useRouter();
  const t = T(lang);

  const [nombre, setNombre] = React.useState('');
  const [recorrido, setRecorrido] = React.useState<string[]>([]);

  // Nombre del usuario: profile users/{uid}.name, fallback displayName.
  React.useEffect(() => {
    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, async (usr: User | null) => {
      if (!usr) return;
      try {
        const snap = await getDoc(doc(getFirebaseDb(), 'users', usr.uid));
        const data = snap.exists() ? (snap.data() as { name?: string }) : {};
        setNombre(data.name || usr.displayName || '');
      } catch {
        setNombre(usr.displayName || '');
      }
    });
    return () => unsub();
  }, []);

  // Recorrido del mapa de mundos (mismo storage que Worlds).
  React.useEffect(() => {
    try {
      const guardado = window.localStorage.getItem('babel_worlds_recorrido_v1');
      if (guardado) {
        const ids = JSON.parse(guardado) as string[];
        if (Array.isArray(ids)) setRecorrido(ids.filter((id) => PUNTOS_RECORRIDO.some((p) => p.id === id)));
      }
    } catch {
      // localStorage no disponible
    }
  }, []);

  React.useEffect(() => {
    try {
      window.localStorage.setItem('babel_worlds_recorrido_v1', JSON.stringify(recorrido));
    } catch {
      // noop
    }
  }, [recorrido]);

  const navegarPunto = (p: PuntoRecorrido) => {
    if (p.interno) {
      const v = p.id === 'partida' ? 'partida' : p.id === 'tablero' ? 'tablero' : 'estrategia';
      router.push(`/${lang}/worlds?v=${v}`);
      return;
    }
    router.push(`/${lang}${p.ruta}`);
  };

  const completarPunto = (id: string) => {
    setRecorrido((prev) => {
      if (prev.includes(id)) return prev;
      return [...prev, id];
    });
  };

  return (
    <div>
      <div className="flex items-center gap-3">
        <AgentAvatar size={56} className="shrink-0" />
        <div>
          <h3 id="inicio-title" className="text-2xl font-bold text-slate-800">
            {t(['¡Hola ', 'Hi '])}
            {nombre ? `${nombre}!` : '!'}
          </h3>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            {t(['Nosotros transformamos tu empresa y tú el mundo', 'We transform your company and you transform the world'])}
          </p>
        </div>
      </div>

      <section id="inicio-dual" className="mt-8">
        <div className="rounded-3xl border border-glass-border bg-glass p-6 text-center shadow-[0_10px_40px_rgba(13,148,136,0.12),inset_0_1px_0_rgba(255,255,255,0.25)] backdrop-blur-2xl backdrop-saturate-150">
          <p className="text-base font-semibold text-slate-600 dark:text-slate-300">
            {t(['Ninguna empresa puede crecer sin', 'No business can grow without'])}
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-2xl border border-teal-200/70 bg-teal-50 p-4 text-left dark:border-teal-800/50 dark:bg-teal-900/30">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-500/15 text-teal-700">
                <Coins className="h-5 w-5" />
              </span>
              <p className="text-sm font-bold leading-snug text-slate-800 dark:text-slate-100">
                {t(['Dinero para invertir en ella', 'Money to invest in it'])}
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-teal-200/70 bg-teal-50 p-4 text-left dark:border-teal-800/50 dark:bg-teal-900/30">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-500/15 text-teal-700">
                <UsersRound className="h-5 w-5" />
              </span>
              <p className="text-sm font-bold leading-snug text-slate-800 dark:text-slate-100">
                {t(['Ayuda de Especialistas en todos los temas', 'Expert help in every topic'])}
              </p>
            </div>
          </div>
          <p className="mt-5 text-2xl font-extrabold text-teal-700 dark:text-teal-300">
            {t(['¡Aquí encontrarás ambos!', 'You will find both here!'])}
          </p>
        </div>
      </section>

      <section id="inicio-agentes" className="mt-8">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-500/15 text-teal-700">
            <Bot className="h-5 w-5" />
          </span>
          <h4 className="text-lg font-bold text-teal-800 dark:text-teal-200">
            {t([
              'Conoce a tus Corpilotos de IA que te ayudarán a recorrer varios mundos empresariales',
              'Meet your AI Copilots that will help you explore several business worlds',
            ])}
          </h4>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {CORPILOTES.map((ag) => (
            <div
              key={ag.agente}
              className="group relative flex h-full flex-col items-center rounded-2xl border border-glass-border bg-glass p-4 text-center shadow-[0_8px_32px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.25)] backdrop-blur-2xl backdrop-saturate-150 transition-all duration-200 ease-executive hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/30"
            >
              <div className="group/zoom">
                <AgentAvatar agente={ag.agente} size={96} className="ring-2 ring-teal-300/40" />
              </div>
              <h5 className="mt-3 text-base font-extrabold text-slate-800 dark:text-slate-100">{ag.agente}</h5>
              <p className="mt-1 text-xs font-semibold leading-relaxed text-teal-700 dark:text-teal-300">{t(ag.temas)}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{t(ag.rasgo)}</p>

              {/* Zoom por hover: solo la imagen, sin nombre ni pose. */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2 opacity-0 transition-all duration-200 ease-out group-hover/zoom:scale-110 group-hover/zoom:opacity-100"
              >
                <div className="h-56 w-56 overflow-hidden rounded-full shadow-2xl shadow-black/40 ring-4 ring-teal-300/70">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/avatars/${ag.agente.toLowerCase()}-reposando.png`}
                    alt=""
                    width={224}
                    height={224}
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="inicio-mundos" className="mt-8">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-500/15 text-teal-700">
            <Bot className="h-5 w-5" />
          </span>
          <h4 className="text-lg font-bold text-teal-800 dark:text-teal-200">
            {t(['Viaja por el universo empresarial de MBE Corp', 'Travel across the MBE Corp business universe'])}
          </h4>
        </div>
        <p className="mt-1 text-sm text-slate-600">
          {t([
            'En cada mundo podrás conectar con tu nuevo equipo de especialistas que trabajarán para ayudarte a crecer con herramientas, mentoría y nuevas formas de enamorar clientes y hacer dinero.',
            'In every world you can connect with your new team of specialists who will work to help you grow with tools, mentoring and new ways to win over clients and make money.',
          ])}
        </p>

        <div className="mt-4">
          <WorldMap lang={lang} doneIds={recorrido} onNavegar={navegarPunto} onCompletar={completarPunto} />
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MUNDOS_ACCESO.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => router.push(`/${lang}/worlds?v=${m.v}`)}
              className="relative flex h-full flex-col rounded-2xl border border-glass-border bg-glass p-4 text-left shadow-[0_8px_32px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.25)] backdrop-blur-2xl backdrop-saturate-150 transition-all duration-200 ease-executive hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/30"
            >
              <div className="text-3xl">{m.icono}</div>
              <h5 className="mt-2 text-sm font-bold text-slate-800 dark:text-slate-100">{t(m.titulo)}</h5>
              <p className="mt-0.5 flex-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{t(m.desc)}</p>
              <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-teal-700 dark:text-teal-300">
                {t(['Entrar al mundo', 'Enter the world'])} →
              </span>
            </button>
          ))}
        </div>

        <h5 className="mb-3 mt-5 text-sm font-bold text-slate-700 dark:text-slate-200">
          {t(['Mundos Premium', 'Premium Worlds'])}{' '}
          <span className="ml-1 inline-block rounded-full border border-amber-300/70 bg-amber-100 px-2 py-0.5 align-middle text-[10px] font-bold text-amber-700 dark:border-amber-700 dark:bg-amber-900 dark:text-amber-200">
            🔑 {t(['plan_mensual', 'monthly plan'])}
          </span>
        </h5>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {MUNDOS_PREMIUM_LABELS.map((m) => (
            <div key={m.id} className="rounded-2xl border border-glass-border bg-glass p-4 opacity-75">
              <div className="text-3xl">{m.icon}</div>
              <div className="mt-2 flex items-center gap-2">
                <AgentAvatar agente={m.agente} size={28} className="ring-2 ring-teal-300/60" />
                <h6 className="text-sm font-extrabold text-slate-800 dark:text-white">
                  {lang === 'en' ? m.en : m.es}
                </h6>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                {t(['Anfitrión', 'Host'])} <b>{m.agente}</b> · {m.subs} {t(['submundos', 'subworlds'])}
              </p>
              <p className="mt-2 rounded-full bg-slate-200 px-2 py-0.5 text-center text-[10px] font-extrabold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {t(['En construcción', 'Under construction'])}
              </p>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-6">
        <PageTour pageId="inicio" steps={PASOS_TOUR[lang]} lang={lang} />
      </div>
    </div>
  );
}
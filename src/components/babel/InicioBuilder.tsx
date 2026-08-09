'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Bot, Coins, UsersRound, Wrench } from 'lucide-react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { getFirebaseAuth, getFirebaseDb } from '@/lib/firebase';
import AgentAvatar, { type AgenteAvatarId } from '@/components/agentes/AgentAvatar';
import PageTour, { type TourStep } from '@/components/ui/executive/PageTour';

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

type MundoAcceso = {
  id: string;
  icono: string;
  agente: AgenteAvatarId;
  titulo: Params;
  desc: Params;
  href: string;
};

const MUNDOS_ACCESO: MundoAcceso[] = [
  {
    id: 'partida',
    icono: '🎓',
    agente: 'Babel',
    titulo: ['Mundo de Partida', 'Starting World'],
    desc: [
      'Queremos saber de dónde partes: evalúa el nivel de tu empresa, define cuánto necesitas ganar en dinero y qué objetivos debes alcanzar.',
      'We want to know where you come from: assess your company level, define how much money you need to earn and the objectives you must reach.',
    ],
    href: '/worlds?v=partida',
  },
  {
    id: 'retos',
    icono: '🎯',
    agente: 'Babel',
    titulo: ['Mundo de Retos', 'Challenges World'],
    desc: [
      'Retos semanales para incrementar tu nivel de madurez.',
      'Weekly challenges to increase your maturity level.',
    ],
    href: '/babel/madurez',
  },
];

type MundoPremium = {
  id: string;
  icono: string;
  agente: AgenteAvatarId;
  titulo: Params;
  desc: Params;
  href?: string;
};

const MUNDOS_PREMIUM: MundoPremium[] = [
  {
    id: 'estrategia',
    icono: '🧭',
    agente: 'Babel',
    titulo: ['Mundo de la Estrategia', 'Strategy World'],
    desc: [
      'Define el rumbo de tu empresa con un enfoque socioambiental y crea un plan para alcanzar tus objetivos.',
      'Define your company path with a socio-environmental approach and create a plan to reach your objectives.',
    ],
    href: '/worlds?v=estrategia',
  },
  {
    id: 'dinero',
    icono: '💰',
    agente: 'Fisnando',
    titulo: ['Mundo del Dinero', 'Money World'],
    desc: [
      'Ten claridad en tus obligaciones fiscales, finanzas y cómo potenciarlas.',
      'Get clarity on your tax obligations, finance and how to boost them.',
    ],
  },
  {
    id: 'cliente',
    icono: '🤝',
    agente: 'Karmetin',
    titulo: ['Mundo del Cliente', 'Customer World'],
    desc: [
      'Identifica quién es tu cliente ideal, atráelo, enamóralo y que te recomiende.',
      'Identify who your ideal customer is, attract them, delight them and get referrals.',
    ],
  },
  {
    id: 'normativo',
    icono: '⚖️',
    agente: 'Normau',
    titulo: ['Mundo Normativo', 'Compliance World'],
    desc: [
      'Protege tu empresa cumpliendo con las reglas que le corresponden.',
      'Protect your company by meeting the rules that apply to it.',
    ],
  },
  {
    id: 'operativo',
    icono: '⚙️',
    agente: 'Atech',
    titulo: ['Mundo Operativo', 'Operations World'],
    desc: [
      'Digitaliza tu toma de decisiones.',
      'Digitalize your decision making.',
    ],
  },
  {
    id: 'cultura',
    icono: '🏛️',
    agente: 'Babel',
    titulo: ['Mundo de la Cultura', 'Culture World'],
    desc: [
      'Crea una cultura laboral donde todos quieran trabajar.',
      'Create a workplace culture where everyone wants to work.',
    ],
  },
];

type ToolboxItem = {
  icono: string;
  titulo: Params;
  desc: Params;
  href: string;
};

const TOOLBOX: ToolboxItem[] = [
  {
    icono: '📣',
    titulo: ['Convocatorias y Fondos', 'Calls & Grants'],
    desc: [
      'Encuentra fondos, becas y convocatorias que encajen con tu perfil de empresa.',
      'Find funds, grants and calls that fit your business profile.',
    ],
    href: '/babel/convocatorias',
  },
  {
    icono: '🏪',
    titulo: ['Reference Place', 'Reference Place'],
    desc: [
      'Comunidad certificada: mercado de referencias, reuniones B2B y más clientes.',
      'Certified community: referrals marketplace, B2B meetings and more clients.',
    ],
    href: '/refplace',
  },
  {
    icono: '📅',
    titulo: ['Juntas de Mentoría', 'Mentoring Meetings'],
    desc: [
      'Juntas semanales de 90 minutos con mentores, agenda y puntos del club.',
      'Weekly 90-minute meetings with mentors, agenda and club points.',
    ],
    href: '/club',
  },
];

const PASOS_TOUR: Record<InicioLang, TourStep[]> = {
  es: [
    { selector: '#inicio-title', title: 'Inicio', description: '¡Hola! Aquí empieza tu viaje con MBE: nosotros transformamos tu empresa y tú el mundo.' },
    { selector: '#inicio-agentes', title: 'Tus especialistas de IA', description: 'Conoce a los 5 agentes que te ayudarán a impulsar tu crecimiento. Toca su avatar para verlo en grande.' },
    { selector: '#inicio-mundos', title: 'El universo MBE', description: 'Viaja por el universo empresarial de MBE Corp: cada mundo te conecta con tu equipo de especialistas, herramientas, mentoría y más clientes.' },
  ],
  en: [
    { selector: '#inicio-title', title: 'Home', description: 'Hi! Your journey with MBE starts here: we transform your company and you transform the world.' },
    { selector: '#inicio-agentes', title: 'Your AI Copilots', description: "Meet the 5 AI agents who help you boost your growth. Tap their avatar to view it big." },
    { selector: '#inicio-mundos', title: 'The MBE universe', description: 'Travel across the business universe of MBE Corp: every world connects you with your specialist team, tools, mentoring and more customers.' },
  ],
};

export default function InicioBuilder({ lang }: { lang: InicioLang }) {
  const router = useRouter();
  const t = T(lang);

  const [nombre, setNombre] = React.useState('');
  const [zoomAgente, setZoomAgente] = React.useState<AgenteAvatarId | null>(null);
  const [partida, setPartida] = React.useState<number[]>([]);
  const [toolboxCargando, setToolboxCargando] = React.useState(true);

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

  // Progreso del Mundo de Partida (users/{uid}.worlds.partida) para decidir
  // si el Toolbox está desbloqueado (3 misiones completadas).
  React.useEffect(() => {
    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, async (usr: User | null) => {
      if (!usr) return;
      try {
        const token = await usr.getIdToken();
        const res = await fetch('/api/worlds', { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        setPartida(Array.isArray(data?.yo?.partida) ? data.yo.partida.map(Number) : []);
      } catch {
        setPartida([]);
      } finally {
        setToolboxCargando(false);
      }
    });
    return () => unsub();
  }, []);

  const toolboxActivo = partida.length >= 3;

  return (
    <div>
      <div className="flex items-center gap-3">
        <AgentAvatar size={56} className="shrink-0" />
        <div>
          <h3 id="inicio-title" className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            {t(['¡Hola ', 'Hi '])}
            {nombre ? `${nombre}!` : '!'}
          </h3>
          <p className="mt-1 text-sm font-semibold text-teal-700 dark:text-teal-300">
            {t(['Nosotros transformamos tu empresa y tú el mundo', 'We transform your company and you transform the world'])}
          </p>
        </div>
      </div>

      <section id="inicio-dual" className="mt-8">
        <div className="rounded-3xl border border-glass-border bg-glass p-6 text-center shadow-[0_10px_40px_rgba(13,148,136,0.12),inset_0_1px_0_rgba(255,255,255,0.25)] backdrop-blur-2xl backdrop-saturate-150">
          <p className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">
            {t(['Tu empresa para crecer solo necesita dos cosas', 'Your business only needs two things to grow'])}
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-2xl border border-teal-200/70 bg-teal-50 p-4 text-left dark:border-teal-800/50 dark:bg-teal-900/30">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-500/15 text-teal-700">
                <Coins className="h-5 w-5" />
              </span>
              <p className="text-lg font-bold leading-snug text-slate-800 dark:text-slate-100">
                {t(['Dinero para reinvertir', 'Money to reinvest'])}
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-teal-200/70 bg-teal-50 p-4 text-left dark:border-teal-800/50 dark:bg-teal-900/30">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-500/15 text-teal-700">
                <UsersRound className="h-5 w-5" />
              </span>
              <p className="text-lg font-bold leading-snug text-slate-800 dark:text-slate-100">
                {t(['Especialistas en todas las áreas', 'Specialists in every area'])}
              </p>
            </div>
          </div>
          <p className="mt-5 text-2xl font-extrabold text-teal-700 dark:text-teal-300">
            {t(['¡Aquí encontrarás ambos!', 'You will find both right here!'])}
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
              'Conoce a tus Corpilotos de IA que te ayudarán a impulsar tu crecimiento',
              'Meet your AI Copilots that will help you boost your growth',
            ])}
          </h4>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {CORPILOTES.map((ag) => (
            <div
              key={ag.agente}
              className="relative flex h-full flex-col items-center rounded-2xl border border-glass-border bg-glass p-4 text-center shadow-[0_8px_32px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.25)] backdrop-blur-2xl backdrop-saturate-150 transition-all duration-200 ease-executive hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/30"
            >
              <AgentAvatar agente={ag.agente} size={96} className="ring-2 ring-teal-300/40" onClick={() => setZoomAgente(ag.agente)} />
              <h5 className="mt-3 text-base font-extrabold text-slate-800 dark:text-slate-100">{ag.agente}</h5>
              <p className="mt-1 text-xs font-semibold leading-relaxed text-teal-700 dark:text-teal-300">{t(ag.temas)}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{t(ag.rasgo)}</p>
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
            'En cada mundo podrás conectar con tu nuevo equipo de especialistas, encontrar herramientas, mentoría y más clientes. Subes de nivel, ganas puntos e insignias en cada paso y te diviertes.',
            'In every world you will connect with your new specialist team, find tools, mentoring and more customers. Level up, earn points and badges at every step, and have fun.',
          ])}
        </p>

        <div className="mt-4">
          <h5 className="mb-3 text-lg font-extrabold text-slate-800 dark:text-white">
            {t(['Mundos Gratis', 'Free Worlds'])}
          </h5>
          <div className="grid gap-3 sm:grid-cols-2">
            {MUNDOS_ACCESO.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => router.push(`/${lang}${m.href}`)}
                className="relative flex h-full flex-col items-center rounded-2xl border border-glass-border bg-glass p-5 text-center shadow-[0_8px_32px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.25)] backdrop-blur-2xl backdrop-saturate-150 transition-all duration-200 ease-executive hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/30"
              >
                <AgentAvatar agente={m.agente} size={72} className="ring-2 ring-teal-300/40" />
                <h6 className="mt-3 flex items-center gap-1.5 text-base font-bold text-slate-800 dark:text-slate-100">
                  <span className="text-lg leading-none">{m.icono}</span> {t(m.titulo)}
                </h6>
                <p className="mt-1 flex-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{t(m.desc)}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-500/15 text-teal-700">
              <Wrench className="h-5 w-5" />
            </span>
            <h5 className="text-lg font-bold text-teal-800 dark:text-teal-200">
              {t(['Toolbox', 'Toolbox'])}
            </h5>
          </div>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {t([
              'Las herramientas de apoyo para hacer crecer tu negocio: fondos, comunidad y mentoría.',
              'The support tools to grow your business: funds, community and mentoring.',
            ])}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {TOOLBOX.map((h) => {
              const cls = 'relative flex h-full flex-col items-center rounded-2xl border border-glass-border bg-glass p-5 text-center shadow-[0_8px_32px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.25)] backdrop-blur-2xl backdrop-saturate-150 transition-all duration-200 ease-executive ' + (toolboxActivo ? 'hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/30' : 'opacity-60');
              const inner = (
                <>
                  <div className="text-3xl">{h.icono}</div>
                  <h6 className="mt-2 text-sm font-extrabold text-slate-800 dark:text-white">{t(h.titulo)}</h6>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{t(h.desc)}</p>
                  {!toolboxActivo && (
                    <span className="mt-3 rounded-full bg-slate-200 px-2.5 py-1 text-center text-[10px] font-extrabold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      🔒 {t(['Bloqueada', 'Locked'])}
                    </span>
                  )}
                </>
              );
              return toolboxActivo ? (
                <button key={h.titulo[0]} type="button" onClick={() => router.push(`/${lang}${h.href}`)} className={cls}>
                  {inner}
                </button>
              ) : (
                <div key={h.titulo[0]} className={cls + ' cursor-not-allowed'}>
                  {inner}
                </div>
              );
            })}
          </div>
          <div
            className={
              'mt-3 rounded-xl border px-4 py-3 text-xs font-semibold ' +
              (toolboxActivo
                ? 'border-emerald-200/70 bg-emerald-50 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-900/30 dark:text-emerald-200'
                : 'border-amber-200/70 bg-amber-50 text-amber-800 dark:border-amber-800/60 dark:bg-amber-900/30 dark:text-amber-200')
            }
          >
            {toolboxCargando
              ? t(['Revisando tu progreso…', 'Checking your progress…'])
              : toolboxActivo
                ? t([
                    '✓ Toolbox desbloqueado por completar el Mundo de Partida.',
                    '✓ Toolbox unlocked by completing the Starting World.',
                  ])
                : t([
                    '🔒 Toolbox bloqueado: completa las 3 misiones del Mundo de Partida (M1 Dashboard, M2 Objetivos estratégicos y M3 Calibración) para desbloquear estas herramientas.',
                    '🔒 Toolbox locked: complete the 3 Starting World missions (M1 Dashboard, M2 Strategic Objectives and M3 Calibration) to unlock these tools.',
                  ])}
          </div>
        </div>

        <h5 className="mb-3 mt-8 text-lg font-extrabold text-slate-800 dark:text-white">
          {t(['Mundos Premium', 'Premium Worlds'])}{' '}
          <span className="ml-1 inline-block rounded-full border border-amber-300/70 bg-amber-100 px-2 py-0.5 align-middle text-[10px] font-bold text-amber-700 dark:border-amber-700 dark:bg-amber-900 dark:text-amber-200">
            🔑 {t(['plan_mensual', 'monthly plan'])}
          </span>
        </h5>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MUNDOS_PREMIUM.map((m) => {
            const inner = (
              <>
                <AgentAvatar agente={m.agente} size={72} className="ring-2 ring-teal-300/40" />
                <h6 className="mt-3 flex items-center gap-1.5 text-sm font-extrabold text-slate-800 dark:text-white">
                  <span className="text-base leading-none">{m.icono}</span> {lang === 'en' ? m.titulo[1] : m.titulo[0]}
                </h6>
                <p className="mt-1 flex-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{lang === 'es' ? m.desc[0] : m.desc[1]}</p>
                {!m.href && (
                  <span className="mt-3 rounded-full bg-slate-200 px-2.5 py-1 text-center text-[10px] font-extrabold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {t(['En construcción', 'Under construction'])}
                  </span>
                )}
              </>
            );
            const cls =
              'relative flex h-full flex-col items-center rounded-2xl border border-glass-border bg-glass p-5 text-center shadow-[0_8px_32px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.25)] backdrop-blur-2xl backdrop-saturate-150 transition-all duration-200 ease-executive hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/30';
            return m.href ? (
              <button key={m.id} type="button" onClick={() => router.push(`/${lang}${m.href}`)} className={cls}>
                {inner}
              </button>
            ) : (
              <div key={m.id} className={cls + ' opacity-80'}>
                {inner}
              </div>
            );
          })}
        </div>
      </section>

      {zoomAgente && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setZoomAgente(null)}
          onKeyDown={(ev) => {
            if (ev.key === 'Escape') setZoomAgente(null);
          }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        >
          <div className="h-64 w-64 overflow-hidden rounded-full shadow-2xl shadow-black/50 ring-4 ring-teal-300/70">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/avatars/${zoomAgente.toLowerCase()}-reposando.png`}
              alt=""
              width={256}
              height={256}
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      )}

      <div className="mt-6">
        <PageTour pageId="inicio" steps={PASOS_TOUR[lang]} lang={lang} />
      </div>
    </div>
  );
}
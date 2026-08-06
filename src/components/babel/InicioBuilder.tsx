'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Award,
  BadgeCheck,
  Bot,
  CalendarClock,
  ChevronRight,
  ClipboardList,
  Coins,
  Gauge,
  LayoutDashboard,
  LineChart,
  Megaphone,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
} from 'lucide-react';
import BabelAvatar from '@/components/babel/BabelAvatar';
import PageTour, { type TourStep } from '@/components/ui/executive/PageTour';

type InicioLang = 'es' | 'en';
type Costo = 'gratis' | 'plan' | 'ondemand';

type Tarjeta = {
  id: string;
  icono: React.ElementType;
  titulo: string;
  desc: string;
  costo: Costo | null;
  precio?: string;
  nota: string;
  futuro: boolean;
  href?: string;
};

type Impulsor = {
  id: string;
  icono: React.ElementType;
  titulo: string;
  sub: string;
  items: Tarjeta[];
  notaCostos: string;
};

const COSTO_CLS: Record<Costo, string> = {
  gratis: 'bg-green-100 text-green-800',
  plan: 'bg-indigo-100 text-indigo-800',
  ondemand: 'bg-amber-100 text-amber-800',
};

const COSTO_LBL: Record<Costo, [string, string]> = {
  gratis: ['Gratis', 'Free'],
  plan: ['Plan mensual', 'Monthly plan'],
  ondemand: ['On-Demand', 'On-demand'],
};

const PASOS_TOUR: Record<InicioLang, TourStep[]> = {
  es: [
    { selector: '#inicio-title', title: 'Inicio', description: 'Bienvenido. Aquí tienes el punto de partida de tu crecimiento en MBE: tu equipo de trabajo con IA y tu acceso a capital.' },
    { selector: '#inicio-impulso-equipo', title: 'Impulso 1 · Equipo con IA', description: 'Tu equipo de cinco agentes de IA trabaja contigo día a día en madurez, finanzas, objetivos y plan de acción.' },
    { selector: '#inicio-impulso-dinero', title: 'Impulso 2 · Acceso a dinero', description: 'Convocatorias, funds, reference place y certificación: el camino para conseguir capital para tu negocio.' },
  ],
  en: [
    { selector: '#inicio-title', title: 'Home', description: 'Welcome. This is the starting point of your growth at MBE: your AI work team and your access to capital.' },
    { selector: '#inicio-impulso-equipo', title: 'Driver 1 · Your AI team', description: 'Five AI agents work with you on strategy, plans, objectives and the action plan.' },
    { selector: '#inicio-impulso-dinero', title: 'Driver 2 · Access to money', description: 'Calls & grants, Reference Place and certification: the path to funding for your business.' },
  ],
};

export default function InicioBuilder({ lang }: { lang: InicioLang }) {
  const router = useRouter();

  const impulsores: Impulsor[] = [
    {
      id: 'inicio-impulso-equipo',
      icono: Bot,
      titulo: lang === 'es' ? 'Impulso 1 · Tu equipo de trabajo con IA' : 'Driver 1 · Your AI Work Team',
      sub:
        lang === 'es'
          ? 'Trabajas duro, pero tu empresa no crece sola. Con estos agentes de IA dejas de operar en solitario: estrategia (Babel), finanzas (Fisnando), ventas (Karmetín), operación (Atech) y normas-capital humano (Normau).'
          : 'You work hard, but the business does not grow alone. With these AI agents you stop operating solo: strategy (Babel), finance (Fisnando), sales (Karmetín), operations (Atech), compliance-HR (Normau).',
notaCostos:
        lang === 'es'
          ? 'Gratis: diagnóstico, objetivos y acceso básico. Plan mensual ($99): Reflexión, Organigrama, Plan de Acción con IA, herramientas de los agentes y asesoría con humanos. On-Demand: apoyo de un especialista humano por entregable.'
          : 'Free: assessment, objectives and basic access. Monthly plan ($99): Reflection, Org Chart, AI Action Plan, agent tools and human advisory. On-Demand: human expert support per deliverable.',
      items: [
        { id: 'resumen', icono: LayoutDashboard, titulo: lang === 'es' ? 'Resumen ejecutivo' : 'Executive Summary', desc: lang === 'es' ? 'Todo tu avance en un vistazo: madurez, fases y plan de acción.' : 'All your progress in one glance: maturity, phases and action plan.', costo: 'gratis', nota: '', futuro: false, href: '/executive-preview' },
        { id: 'madurez', icono: Gauge, titulo: lang === 'es' ? 'Evaluación de madurez' : 'Maturity Assessment', desc: lang === 'es' ? 'Descubre el nivel de madurez de tu empresa en 11 temas.' : 'Discover your business maturity level across 11 topics.', costo: 'gratis', nota: '', futuro: false, href: '/dashboard' },
        { id: 'mejora', icono: LineChart, titulo: lang === 'es' ? 'Mejora del Nivel de Madurez' : 'Maturity Improvement', desc: lang === 'es' ? 'Prácticas mensuales y Scrum semanal para subir de nivel con cada agente.' : 'Monthly practices and weekly Scrum to level up with each agent.', costo: 'gratis', nota: lang === 'es' ? 'Apoyo IA: Plan $99/mes · Apoyo humano: Entregable On-Demand' : 'AI support: $99/mo plan · Human support: On-Demand deliverable', futuro: false, href: '/babel/madurez' },
        { id: 'objetivos', icono: TrendingUp, titulo: lang === 'es' ? 'Objetivos estratégicos' : 'Strategic Objectives', desc: lang === 'es' ? 'Metas con fórmula, indicadores y metas financieras.' : 'Goals with formulas, indicators and financial targets.', costo: 'gratis', nota: '', futuro: false, href: '/babel/indicadores' },
        { id: 'reflexion', icono: Sparkles, titulo: lang === 'es' ? 'Reflexión estratégica' : 'Strategic Reflection', desc: lang === 'es' ? 'Alineación socioambiental de tu rumbo con Babel.' : 'Socio-environmental alignment of your direction with Babel.', costo: 'plan', precio: lang === 'es' ? '$99/mes' : '$99/mo', nota: '', futuro: false, href: '/babel' },
        { id: 'organigrama', icono: Users, titulo: lang === 'es' ? 'Organigrama y Roles' : 'Org Chart & Roles', desc: lang === 'es' ? 'Define roles, responsables y tu directorio de contactos.' : 'Define roles, owners and your contacts directory.', costo: 'plan', precio: lang === 'es' ? '$99/mes' : '$99/mo', nota: '', futuro: false, href: '/babel/organigrama' },
        { id: 'plan', icono: ClipboardList, titulo: lang === 'es' ? 'Plan de acción estratégico' : 'Strategic Action Plan', desc: lang === 'es' ? 'Especialistas con IA construyen tus acciones y factibilidad.' : 'Specialists with AI build your actions and feasibility.', costo: 'plan', precio: lang === 'es' ? '$99/mes' : '$99/mo', nota: lang === 'es' ? 'Especialista humano: Entregable On-Demand' : 'Human specialist: On-Demand deliverable', futuro: false, href: '/babel/plan-accion' },
        { id: 'herramientas', icono: Bot, titulo: lang === 'es' ? 'Herramientas de los Agentes de IA' : 'AI agent tools', desc: lang === 'es' ? 'Herramientas profundas y paneles de cada agente para tu negocio.' : 'Deeper tools and dashboards from each agent for your business.', costo: 'plan', precio: lang === 'es' ? '$99/mes' : '$99/mo', nota: '', futuro: true },
        { id: 'asesoria', icono: CalendarClock, titulo: lang === 'es' ? 'Sesiones de asesoría con humanos · 30 min' : 'Human advisory sessions · 30 min', desc: lang === 'es' ? 'Agenda sesiones breves con un asesor MBE en tu plan.' : 'Book short sessions with an MBE advisor in your plan.', costo: 'plan', precio: lang === 'es' ? '$99/mes' : '$99/mo', nota: '', futuro: true },
        { id: 'mentorias', icono: CalendarClock, titulo: lang === 'es' ? 'Juntas de mentoría semanales' : 'Weekly mentoring meetings', desc: lang === 'es' ? 'Acompañamiento de mentor en grupo, en vivo y cada semana.' : 'Group mentoring, live, every week.', costo: 'gratis', nota: '', futuro: true },
      ],
    },
    {
      id: 'inicio-impulso-dinero',
      icono: Coins,
      titulo: lang === 'es' ? 'Impulso 2 · Acceso a dinero' : 'Driver 2 · Access to money',
      sub:
        lang === 'es'
          ? 'El segundo problema: no tener capital estratégico. Te conectamos con convocatorias abiertas, fondos, mentores y certificación para que tu empresa acceda a dinero y crezca.'
          : 'The second problem: no strategic capital. We connect you with open calls, grants, mentors and certification so your business gets funded and grows.',
notaCostos:
        lang === 'es'
          ? 'Gratis: directorio de convocatorias. Plan mensual ($99): Reference Place para empresas ya certificadas. On-Demand: entregables de apoyo humano ($4,000 c/u), paquete de especialista con 4 entregables al mes ($10,000) y certificación ($5,000).'
          : 'Free: calls directory. Monthly plan ($99): Reference Place for certified businesses. On-Demand: human support deliverables ($4,000 each), a specialist package with 4 deliverables per month ($10,000), and certification ($5,000).',
      items: [
        { id: 'convo', icono: Megaphone, titulo: lang === 'es' ? 'Convocatorias y fondos' : 'Calls & Grants', desc: lang === 'es' ? 'Directorio vivo de convocatorias, premios y fondos con tu perfil para ver a cuáles postulas.' : 'Living directory of calls, awards and grants matched to your profile.', costo: 'gratis', nota: '', futuro: false, href: '/babel/convocatorias' },
        { id: 'deliverable', icono: UserCheck, titulo: lang === 'es' ? 'Entregable On-Demand' : 'On-Demand deliverable', desc: lang === 'es' ? 'Apoyo humano personalizado en el Plan de Acción, convocatorias, mejora de madurez o certificación.' : 'Custom human support on your Action Plan, calls & grants, maturity improvement or certification.', costo: 'ondemand', precio: lang === 'es' ? '$4,000 MXN' : '$4,000 MXN', nota: lang === 'es' ? 'Contacta a un experto en una reunión de 30 mins gratis para más información de los entregables.' : 'Talk to an expert in a free 30-min meeting to learn more about the deliverables.', futuro: true },
        { id: 'paquete', icono: BadgeCheck, titulo: lang === 'es' ? 'Paquete de Especialista' : 'Specialist package', desc: lang === 'es' ? 'Un especialista te apoya con 4 entregables en un mes.' : 'A specialist supports you with 4 deliverables in one month.', costo: 'ondemand', precio: lang === 'es' ? '$10,000 MXN' : '$10,000 MXN', nota: '', futuro: true },
        { id: 'cert', icono: Award, titulo: lang === 'es' ? 'Certificación MBE' : 'MBE Certification', desc: lang === 'es' ? 'Certificación para lograr el sello de tu negocio ante compradores e inversores.' : 'Certification to earn your business badge with buyers and investors.', costo: 'ondemand', precio: lang === 'es' ? '$5,000 MXN' : '$5,000 MXN', nota: '', futuro: true },
        { id: 'refplace', icono: Coins, titulo: lang === 'es' ? 'Reference Place (ya certificado)' : 'Reference Place (already certified)', desc: lang === 'es' ? 'Referencias de tu proyecto ante fondos y empresas certificadas.' : 'Project references with leading funds and certified businesses.', costo: 'plan', precio: lang === 'es' ? '$99/mes' : '$99/mo', nota: lang === 'es' ? 'Para empresas ya certificadas.' : 'For already certified businesses.', futuro: true },
      ],
    },
  ];

  return (
    <div>
      <div className="flex items-center gap-3">
        <BabelAvatar size={56} className="shrink-0" />
        <div>
          <h3 id="inicio-title" className="text-2xl font-bold text-slate-800">
            {lang === 'es' ? 'Inicio' : 'Home'}
          </h3>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            {lang === 'es'
              ? 'Tu empresa no crece sin equipo ni sin acceso a dinero. Aquí tienes ambos.'
              : 'Your business grows only with a team and capital access. You have both here.'}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {lang === 'es'
              ? 'En MBE Corpilot AI te conectamos con tus herramientas, tus agentes de IA y las oportunidades de financiamiento para crecer con método.'
              : 'MBE Corpilot AI connects you with your tools, your AI agents and funding opportunities to grow with method.'}
          </p>
        </div>
      </div>

      {impulsores.map((imp) => {
        const ImIcon = imp.icono;
        return (
          <section key={imp.id} id={imp.id} className="mt-8">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-500/15 text-teal-700">
                <ImIcon className="h-5 w-5" />
              </span>
              <h4 className="text-lg font-bold text-teal-800">{imp.titulo}</h4>
            </div>
            <p className="mt-1 text-sm text-slate-600">{imp.sub}</p>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {imp.items.map((it) => {
                const ItIcon = it.icono;
                const costo = it.costo ? COSTO_LBL[it.costo][lang === 'es' ? 0 : 1] : null;
                const costoCls = it.costo ? COSTO_CLS[it.costo] : '';
                const Disabled = it.futuro;
                return (
                  <button
                    type="button"
                    key={it.id}
                    disabled={Disabled}
                    onClick={() => !Disabled && it.href && router.push(`/${lang}${it.href}`)}
                    className={
                      'relative flex h-full flex-col rounded-xl border bg-white p-4 text-left shadow-sm transition ' +
                      (Disabled
                        ? 'border-dashed border-slate-300 opacity-90'
                        : 'border-slate-200 hover:border-teal-400 hover:shadow-md')
                    }
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-500/15 text-teal-700">
                        <ItIcon className="h-5 w-5" />
                      </span>
                      <div className="flex flex-wrap items-center gap-1">
                        {Disabled && (
                          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                            {lang === 'es' ? 'Próximamente' : 'Coming soon'}
                          </span>
                        )}
                        {costo && (
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${costoCls}`}>{costo}</span>
                        )}
                        {it.precio && (
                          <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-teal-800">
                            {it.precio}
                          </span>
                        )}
                      </div>
                    </div>
                    <h5 className="mt-2 text-sm font-bold text-slate-800">{it.titulo}</h5>
                    <p className="mt-0.5 flex-1 text-xs leading-relaxed text-slate-600">{it.desc}</p>
                    {it.nota && <p className="mt-2 text-[11px] italic text-teal-700">{it.nota}</p>}
                    {!Disabled && it.href && (
                      <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-teal-700">
                        {lang === 'es' ? 'Entrar' : 'Open'}
                        <ChevronRight className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <p className="mt-3 text-[11px] text-slate-400">{imp.notaCostos}</p>
          </section>
        );
      })}

      <p className="mt-8 text-[11px] text-slate-400">
        {lang === 'es'
          ? 'Cada apoyo On-Demand inicia con una reunión gratuita de 30 minutos con un experto para que conozcas los entregables. Los montos pueden ajustarse aún.'
          : 'Every On-Demand support starts with a free 30-minute meeting with an expert so you can learn about the deliverables. Prices may still be adjusted.'}
      </p>

      <p className="mt-3 text-[11px] text-slate-400">
        {lang === 'es'
          ? 'Los planes se habilitarán próximamente. Hoy puedes usar toda la app.'
          : 'Paid plans will be enabled soon. Today you can use everything.'}
      </p>

      <div className="mt-6">
        <PageTour pageId="inicio" steps={PASOS_TOUR[lang]} lang={lang} />
      </div>
    </div>
  );
}
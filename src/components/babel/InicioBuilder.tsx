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
  costoLabel?: string;
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
  plan: ['Incluido en el Plan Corpilot', 'Included in the Corpilot Plan'],
  ondemand: ['On-Demand', 'On-demand'],
};

const PASOS_TOUR: Record<InicioLang, TourStep[]> = {
  es: [
    { selector: '#inicio-title', title: 'Inicio', description: 'Bienvenido. Aquí tienes el punto de partida de tu crecimiento en MBE: tu acceso a capital y tu equipo directivo.' },
    { selector: '#inicio-impulso-dinero', title: 'Impulso 1 · Acceso a dinero', description: 'Convocatorias, fondos, certificación y Reference Place: el camino para bajar capital para tu negocio.' },
    { selector: '#inicio-impulso-equipo', title: 'Impulso 2 · Tu equipo directivo', description: 'Especialistas Senior y de IA que se vuelven tu Consejo y Equipo Directivo.' },
  ],
  en: [
    { selector: '#inicio-title', title: 'Home', description: 'Welcome. This is the starting point of your growth at MBE: your access to capital and your executive team.' },
    { selector: '#inicio-impulso-dinero', title: 'Driver 1 · Access to money', description: 'Calls & grants, certification and Reference Place: the path to raise capital for your business.' },
    { selector: '#inicio-impulso-equipo', title: 'Driver 2 · Your executive team', description: 'Senior and AI specialists who become your Board and Executive Team.' },
  ],
};

export default function InicioBuilder({ lang }: { lang: InicioLang }) {
  const router = useRouter();

const impulsores: Impulsor[] = [
    {
      id: 'inicio-impulso-dinero',
      icono: Coins,
      titulo: lang === 'es' ? 'Impulso 1 · Acceso a dinero' : 'Driver 1 · Access to money',
      sub:
        lang === 'es'
          ? 'Es una gran barrera de crecimiento no tener dinero para invertir. Te damos acceso a convocatorias, premios y fondos para lograr bajar capital. También te referimos con grandes empresas con las que gente de nuestra comunidad ya trabaja.'
          : 'Not having money to invest is a huge growth barrier. We give you access to calls for proposals, awards and funds to raise capital. We also refer you to large companies that people in our community already work with.',
      notaCostos:
        lang === 'es'
          ? 'Gratis: directorio de convocatorias y objetivos estratégicos. On-Demand: apoyo de especialista, paquete y certificación, cada uno con su precio. Reference Place incluido en el Plan Corpilot.'
          : 'Free: calls directory and strategic objectives. On-Demand: specialist support, package and certification, each priced separately. Reference Place included in the Corpilot Plan.',
      items: [
        { id: 'convo', icono: Megaphone, titulo: lang === 'es' ? 'Convocatorias y fondos' : 'Calls & Grants', desc: lang === 'es' ? 'Directorio vivo de convocatorias, premios y fondos con tu perfil para ver a cuáles postulas.' : 'Living directory of calls, awards and grants matched to your profile.', costo: 'gratis', nota: '', futuro: false, href: '/babel/convocatorias' },
        { id: 'objetivos', icono: TrendingUp, titulo: lang === 'es' ? 'Objetivos Estratégicos' : 'Strategic Objectives', desc: lang === 'es' ? 'Tus metas financieras y punto de equilibrio para saber cuánto debes crecer.' : 'Your financial targets and break-even point to know how much you must grow.', costo: 'gratis', nota: '', futuro: false, href: '/babel/indicadores' },
        { id: 'refplace', icono: Coins, titulo: lang === 'es' ? 'Reference Place' : 'Reference Place', desc: lang === 'es' ? 'Obtén referencias de grandes empresas una vez que te hayas certificado.' : 'Get references from large companies once you are certified.', costo: 'plan', precio: lang === 'es' ? '$99/mes' : '$99/mo', nota: '', futuro: true },
        { id: 'cert', icono: BadgeCheck, titulo: lang === 'es' ? 'Certificación MBE' : 'MBE Certification', desc: lang === 'es' ? 'Obtén tu sello de confianza para recibir referencias e inversiones.' : 'Get your trust seal to receive references and investments.', costo: 'ondemand', precio: lang === 'es' ? '$5,000/Año' : '$5,000/year', nota: '', futuro: true },
        { id: 'apoyo', icono: UserCheck, titulo: lang === 'es' ? 'Apoyo On Demand' : 'On-Demand support', desc: lang === 'es' ? 'Apoyo de un Especialista de nivel directivo para conseguir una convocatoria / premio / fondo, o para alcanzar el nivel de certificación.' : 'Support from an executive-level Specialist to win a call / award / fund, or to reach certification level.', costo: 'ondemand', precio: lang === 'es' ? '$4,000 MXN' : '$4,000 MXN', nota: lang === 'es' ? 'Agenda una reunión gratis con algún especialista para más información de este tema.' : 'Book a free meeting with a specialist to learn more about this topic.', futuro: false },
        { id: 'paquete', icono: Award, titulo: lang === 'es' ? 'Paquete de Especialista' : 'Specialist package', desc: lang === 'es' ? 'Un especialista en un área interviene tu empresa y te da hasta 4 entregables en un mes.' : 'A specialist in one area works with your company and delivers up to 4 deliverables in a month.', costo: 'ondemand', precio: lang === 'es' ? '$10,000 MXN' : '$10,000 MXN', nota: '', futuro: true },
      ],
    },
    {
      id: 'inicio-impulso-equipo',
      icono: Bot,
      titulo: lang === 'es' ? 'Impulso 2 · Tu Equipo Directivo On Demand' : 'Driver 2 · Your On-Demand Executive Team',
      sub:
        lang === 'es'
          ? 'No trabajes más, trabaja más inteligentemente. Especialistas Senior y de IA en Estrategia Socioambiental, Marketing, Comercial, Experiencia del Cliente, Finanzas, Normatividad, Operación, Digitalización y Capital Humano se vuelven tu Consejo y Equipo Directivo.'
          : 'Work smarter, not harder. Senior and AI specialists in Socio-Environmental Strategy, Marketing, Sales, Customer Experience, Finance, Compliance, Operations, Digitalization and Human Capital become your Board and Executive Team.',
      notaCostos:
        lang === 'es'
          ? 'Gratis: evaluación y mejora de madurez, juntas de mentoría. Incluido en el Plan Corpilot: estrategia socioambiental, equipo directivo IA y asesoría del consejo.'
          : 'Free: maturity assessment and improvement, mentoring meetings. Included in the Corpilot Plan: socio-environmental strategy, AI executive team and board advisory.',
      items: [
        { id: 'mentorias', icono: CalendarClock, titulo: lang === 'es' ? 'Juntas de Mentoría' : 'Mentoring Meetings', desc: lang === 'es' ? 'Reuniones semanales con otros empresarios para recibir y dar mentoría de diversos temas. Agenda sesiones con algún empresario para Compras, Asesoría, Trueques, Alianzas Estratégicas y Referencias sencillas. No recorras este camino en solitario y participa en la comunidad.' : 'Weekly meetings with other entrepreneurs to give and receive mentoring on many topics. Book sessions with another entrepreneur for Purchases, Advisory, Trades, Strategic Alliances and simple referrals. Do not walk this path alone; join the community.', costo: 'gratis', nota: '', futuro: true },
        { id: 'madurez', icono: Gauge, titulo: lang === 'es' ? 'Evaluación y Mejora del Nivel de Madurez' : 'Maturity Assessment & Improvement', desc: lang === 'es' ? 'Evalúa tu madurez y obtén un plan para mejorarlo con tareas semanales y mensuales.' : 'Assess your maturity and get a plan to improve it with weekly and monthly tasks.', costo: 'gratis', nota: '', futuro: false, href: '/babel/madurez' },
        { id: 'estrategia', icono: Sparkles, titulo: lang === 'es' ? 'Estrategia socioambiental' : 'Socio-environmental Strategy', desc: lang === 'es' ? 'Babel define tu rumbo estratégico desde una perspectiva socioambiental, identifica su organigrama y realiza un plan de acción para alcanzar tus objetivos estratégicos.' : 'Babel defines your strategic direction from a socio-environmental perspective, maps your org chart and builds an action plan to reach your strategic objectives.', costo: 'plan', precio: lang === 'es' ? '$99/mes' : '$99/mo', nota: '', futuro: false, href: '/babel' },
        { id: 'directivo-ia', icono: Bot, titulo: lang === 'es' ? 'Equipo Directivo IA' : 'AI Executive Team', desc: lang === 'es' ? 'Accede a más herramientas de nuestros agentes de IA. Babel: Alianzas y Enfoque Socioambiental Congruente. Karmetín: Marketing, Ventas y Atención al cliente. Normau: Cumplimiento Normativo, Capital Humano y Cultura Organizacional. Fisnando: Finanzas y Fiscal. Atech: Operación y Digitalización.' : 'Access more tools from our AI agents. Babel: Alliances and Congruent Socio-Environmental Focus. Karmetín: Marketing, Sales and Customer Service. Normau: Compliance, Human Capital and Organizational Culture. Fisnando: Finance and Tax. Atech: Operations and Digitalization.', costo: 'plan', precio: lang === 'es' ? '$99/mes' : '$99/mo', nota: '', futuro: true },
        { id: 'asesoria', icono: CalendarClock, titulo: lang === 'es' ? 'Asesoría del Consejo Directivo' : 'Board Advisory', desc: lang === 'es' ? 'Agenda sesiones de 30 minutos con la contraparte humana de uno de nuestros agentes de IA para recibir orientación y aclarar dudas.' : 'Book 30-minute sessions with the human counterpart of one of our AI agents for guidance and to clarify doubts.', costo: 'plan', precio: lang === 'es' ? '$99/mes' : '$99/mo', nota: '', futuro: true },
      ],
    },
  ];

  return (
    <div>
      <div className="flex items-center gap-3">
        <BabelAvatar size={56} className="shrink-0" />
        <div>
          <h3 id="inicio-title" className="text-2xl font-bold text-slate-800">
            {lang === 'es' ? 'Impulsamos el crecimiento de tu empresa' : 'We drive your company growth'}
          </h3>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            {lang === 'es'
              ? 'Ninguna empresa puede crecer sin Dinero para invertir y sin un Equipo de Trabajo con Especialistas Senior en varios temas. Aquí tienes ambos.'
              : 'No business can grow without money to invest and without a Work Team of Senior Specialists in several fields. Here you have both.'}
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
'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { onAuthStateChanged } from 'firebase/auth';
import { Timestamp } from 'firebase/firestore';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getFirebaseAuth } from '@/lib/firebase';
import {
  getOrCreateBabelSession,
  saveBabelMessages,
  approveBabelPhase,
  compileApprovedPhases,
  resetBabelSession,
  updateBabelPhaseSummary,
} from '@/lib/babel-session';
import { BABEL_IMPLEMENTED_PHASES, babelApprovalMarker, babelPhaseTopics } from '@/lib/babel-constants';
import { downloadCompiledPlanPdf } from '@/lib/deliverables';
import { Button } from '@/components/ui/button';
import { useDisplayLang } from '@/components/display-lang-provider';
import PageTour, { type TourStep } from '@/components/ui/executive/PageTour';
import AgentAvatar from '@/components/agentes/AgentAvatar';
import type { BabelPhaseRecord, ChatMessage, SessionDoc } from '@/types/firestore';
// Preguntas de la Fase 0 (una por una) — alineadas con las 5 respuestas que
// pide el prompt de Fase 0 en src/app/api/babel/route.ts.
const PHASE_0_QUESTIONS = {
  es: [
    { key: 'ubicacion', question: '### 1. Lugar de operación\n\n¿En qué ciudad, estado y país operará el negocio?' },
    { key: 'giro', question: '### 2. Giro y mercado objetivo\n\n¿Qué productos o servicios ofreces y a quién van dirigidos?' },
    { key: 'resultado_cliente', question: '### 3. Resultado al cliente\n\n¿Qué resultado obtienen tus clientes y qué necesidad les satisface tu producto o servicio?' },
    { key: 'madurez', question: '### 4. Etapa actual\n\n¿Es una idea en papel, un producto o servicio ya validado, o un negocio en escalamiento?' },
    { key: 'recursos', question: '### 5. Recursos disponibles\n\n¿Con qué recursos humanos, materiales, intelectuales y financieros cuentas actualmente?' },
  ],
  en: [
    { key: 'ubicacion', question: '### 1. Location\n\nIn which city, state and country will the business operate?' },
    { key: 'giro', question: '### 2. Business Type and Target Market\n\nWhat products or services do you offer, and who are they for?' },
    { key: 'resultado_cliente', question: '### 3. Client Outcome\n\nWhat outcome do your clients get, and what need does your product or service satisfy?' },
    { key: 'madurez', question: '### 4. Current Stage\n\nIs it a paper idea, an already validated product or service, or a business scaling up?' },
    { key: 'recursos', question: '### 5. Available Resources\n\nWhat human, material, intellectual and financial resources do you currently have?' },
  ],
};
// Textos de interfaz que normalmente vienen de next-intl (t()), pero que
// necesitamos poder mostrar en el idioma que el usuario elija con el
// selector ES/EN, aunque no coincida con el idioma de la ruta (locale).
const UI_FALLBACK: Record<'es' | 'en', {
  title: string;
  subtitle: string;
  loading: string;
  send: string;
  approveFinalButton: string;
  approveButton: (phase: number) => string;
  downloadDeliverable: string;
  loadingReply: string;
  placeholder: string;
}> = {
  es: {
    title: 'Reflexión Estratégica',
    subtitle: 'Tu Strategic Business Architect. Vamos a construir juntos tu Plan de Negocio Estratégico Socioambiental, fase por fase.',
    loading: 'Cargando...',
    send: 'Enviar',
    approveFinalButton: 'Aprobar y finalizar plan',
    approveButton: function (phase: number) { return 'Aprobar Fase ' + phase + ' y continuar'; },
    downloadDeliverable: 'Descargar entregable',
    loadingReply: 'Babel está escribiendo...',
    placeholder: 'Escribe tu mensaje...',
  },
  en: {
    title: 'Strategic Reflection',
    subtitle: "Your Strategic Business Architect. Let's build your Socio-Environmental Strategic Business Plan together, phase by phase.",
    loading: 'Loading...',
    send: 'Send',
    approveFinalButton: 'Approve and finish plan',
    approveButton: function (phase: number) { return 'Approve Phase ' + phase + ' and continue'; },
    downloadDeliverable: 'Download deliverable',
    loadingReply: 'Babel is typing...',
    placeholder: 'Type your message...',
  },
};
const FASE0_ORDERED_KEYS = ['ubicacion', 'giro', 'resultado_cliente', 'madurez', 'recursos'];
function fase0IntroText(lang: 'es' | 'en'): string {
  return lang === 'en'
    ? 'Hi! I\'m **Babel**, MBE Corp\'s Strategic Business Architect & Sustainability Lead.\n\nTo get started on the right foot, I\'ll ask you **5 key questions**, one at a time. Take your time.\n\n**Note:** Use Enter to add a new line. The message is only sent when you press the "Send" button.\n\n---\n\n'
    : 'Hola! Soy **Babel**, Strategic Business Architect & Sustainability Lead de MBE Corp.\n\nPara iniciar con el pie derecho, te hare **5 preguntas clave** una por una. Responde con calma.\n\n**Nota:** Usa la tecla Enter para bajar de renglon. El mensaje solo se envia cuando presionas el boton "Enviar".\n\n---\n\n';
}
function fase0LabelsFor(lang: 'es' | 'en'): Record<string, string> {
  return lang === 'en'
    ? { ubicacion: 'Location', giro: 'Business Type and Target Market', resultado_cliente: 'Client Outcome', madurez: 'Current Stage', recursos: 'Available Resources' }
    : { ubicacion: 'Lugar de operación', giro: 'Giro y mercado objetivo', resultado_cliente: 'Resultado al cliente', madurez: 'Etapa actual', recursos: 'Recursos disponibles' };
}
function buildFase0Summary(answers: Record<string, string>, lang: 'es' | 'en'): { userContent: string; assistantContent: string } {
  const labels = fase0LabelsFor(lang);
  const conclusionLines = FASE0_ORDERED_KEYS
    .filter(function (k) { return answers[k] !== undefined; })
    .map(function (k) { return '**' + (labels[k] ?? k) + ':** ' + answers[k]; });
  const summaryLabel = lang === 'en' ? 'Phase 0 completed:' : 'Fase 0 completada:';
  const conclusionHeader = lang === 'en' ? '### Phase 0 Summary — Initial Calibration' : '### Resumen de Fase 0 — Calibración Inicial';
  const conclusionQuestion = lang === 'en' ? 'Do you approve this Phase 0 summary to continue to Phase 1?' : '¿Apruebas este resumen de la Fase 0 para continuar a la Fase 1?';
  const userContent = summaryLabel + '\n\n' + conclusionLines.join('\n\n');
  const assistantContent = conclusionHeader + '\n\n' + conclusionLines.join('\n\n---\n\n') + '\n\n---\n\n*' + conclusionQuestion + '*';
  return { userContent: userContent, assistantContent: assistantContent };
}
/** Indicador compacto de las 5 fases de Babel (0-4): aprobada / actual / pendiente. */
function limpiarMarkdown(texto: string): string {
  return texto
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*([^*]*)\*/g, '$1')
    .replace(/(^|\n)\s*#{1,6}[ \t]*/g, '\n')
    .replace(/(^|\n)[ \t]*---+[ \t]*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
/** Rango [inicio, fin] de mensajes que pertenecen a una fase (1-4) en la
 * conversación continua de la sesión. El límite de cada fase es el mensaje
 * cuyo contenido coincide con el resumen aprobado y guardado en phases[];
 * la fase 0 es el par [0, 1] (mensaje de usuario + resumen de Babel). */
function rangoDeFase(session: SessionDoc, fase: number): { inicio: number; fin: number; alcanzada: boolean } {
  const msgs = session.messages;
  const indiceDelResumen = function (phase: number): number {
    const rec = (session.phases ?? []).find(function (p) { return p.phase === phase; });
    if (!rec) return -1;
    const s = rec.summary;
    for (let i = 0; i < msgs.length; i++) {
      const c = msgs[i].content;
      if (c === s || (s.length > 40 && c.startsWith(s))) return i;
    }
    return -1;
  };
  const fin = indiceDelResumen(fase);
  const inicio = fase <= 0 ? 0 : indiceDelResumen(fase - 1) + 1;
  const alcanzada = fin >= 0 || (session.currentPhase ?? 0) >= fase;
  return { inicio: Math.max(0, inicio), fin: fin >= 0 ? fin : msgs.length - 1, alcanzada };
}
function PhaseStepper({
  currentPhase,
  approved,
  lang,
  solo,
}: {
  currentPhase: number;
  approved: BabelPhaseRecord[];
  lang: 'es' | 'en';
  solo?: number | null;
}) {
  const topics = babelPhaseTopics(lang);
  const fases = solo !== undefined && solo !== null ? [solo] : topics.map(function (_t, i) { return i; });
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {fases.map((phase) => {
        const topic = topics[phase];
        if (!topic) return null;
        const isApproved = approved.some(function (p) { return p.phase === phase; });
        const isCurrent = !isApproved && phase === currentPhase;
        const label = topic.split(':')[1]?.trim() ?? topic;
        return (
          <span
            key={phase}
            data-phase={phase}
            className={
              'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ' +
              (isApproved
                ? 'border-green-200 bg-green-50 text-green-700'
                : isCurrent
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-slate-200 bg-white text-slate-400')
            }
          >
            {isApproved ? '✓ ' : ''}
            {phase}. {label}
          </span>
        );
      })}
    </div>
  );
}

// Banner de "vista enfocada": cuando se entra a la pagina por una fase
// especifica (p. ej. desde el Mundo de la Estrategia o una mision del Mundo
// de Partida), muestra cual fase se esta consultando y permite volver a la
// Reflexion Estrategica completa.
function FaseBanner({ fase, lang, locale }: { fase: number; lang: 'es' | 'en'; locale: string }) {
  const topics = babelPhaseTopics(lang);
  const label = fase >= 0 && fase < topics.length ? (topics[fase].split(':')[1]?.trim() ?? topics[fase]) : '';
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-teal-300/70 bg-teal-50/90 px-4 py-2.5 text-sm dark:border-teal-800 dark:bg-teal-950/40">
      <span className="font-medium text-teal-900 dark:text-teal-100">
        {lang === 'en' ? 'Focused view' : 'Vista enfocada'}: <span className="font-bold">Fase {fase} — {label}</span>
      </span>
      <a
        href={'/' + locale + '/babel'}
        className="text-xs font-bold text-teal-700 underline underline-offset-2 hover:text-teal-900 dark:text-teal-300"
      >
        {lang === 'en' ? 'Open full Strategic Reflection →' : 'Abrir Reflexión Estratégica completa →'}
      </a>
    </div>
  );
}

export function BabelPageChat({ faseInicial }: { faseInicial?: number }) {
  const locale = useLocale() as 'es' | 'en';
  const t = useTranslations('babel');
  const router = useRouter();
  const [uid, setUid] = React.useState<string | null>(null);
  const [session, setSession] = React.useState<SessionDoc | null>(null);
  const [input, setInput] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const retryRef = React.useRef<(() => Promise<void>) | null>(null);
  const [editingMessageIndex, setEditingMessageIndex] = React.useState<number | null>(null);
  const [editContent, setEditContent] = React.useState('');
  const [chatExpanded, setChatExpanded] = React.useState<Set<number>>(new Set());
  const [compiling, setCompiling] = React.useState(false);
  const [showManualEditor, setShowManualEditor] = React.useState(false);
  const [manualContent, setManualContent] = React.useState('');
  const [currentQuestionIndex, setCurrentQuestionIndex] = React.useState(0);
  const [phase0Answers, setPhase0Answers] = React.useState<Record<string, string>>({});
  const [isPhase0Complete, setIsPhase0Complete] = React.useState(false);
  const [dispLang, setDispLang] = React.useState<'es' | 'en'>(locale);
  const { lang: ctxLang } = useDisplayLang();
  React.useEffect(() => { setDispLang(ctxLang); }, [ctxLang]);
  // Cache de traducciones (por IA) del contenido REAL de los mensajes de
  // Babel, para cuando dispLang no coincide con el idioma en que se generaron.
  // Clave: indice del mensaje + '::' + idioma destino.
  const [translatedCache, setTranslatedCache] = React.useState<Record<string, string>>({});
  const [translatingSet, setTranslatingSet] = React.useState<Set<number>>(new Set());
  const bottomRef = React.useRef<HTMLDivElement>(null);
  // Parte en false: al entrar nadie esta "cerca del fondo". Solo se activa
  // cuando el usuario de verdad scrollea hasta el final del chat.
  const nearBottomRef = React.useRef(false);
  const scrolledTopRef = React.useRef(false);
  const questions = PHASE_0_QUESTIONS[dispLang];
  React.useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/' + locale);
        return;
      }
      setUid(user.uid);
      const s = await getOrCreateBabelSession(user.uid, locale);
      setSession(s);
    });
    return unsubscribe;
  }, [locale, router]);
  // Al entrar a la pagina la vista SIEMPRE inicia arriba (incluso al volver
  // con el boton atras del navegador, que restaura el scroll previo).
  React.useEffect(() => {
    window.scrollTo(0, 0);
    const onScroll = () => {
      const el = bottomRef.current;
      if (!el) return;
      nearBottomRef.current = el.getBoundingClientRect().bottom - window.innerHeight < 120;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  // Cuando la sesion termina de cargar (el chat se monta tarde), se vuelve a
  // forzar arriba por si la restauracion del navegador bajo la pagina.
  React.useEffect(() => {
    if (session && !scrolledTopRef.current) {
      scrolledTopRef.current = true;
      window.scrollTo(0, 0);
    }
  }, [session]);
  // Vista enfocada por fase: hace scroll hasta el chip de la fase e ilumina
  // la "Fase X" que se esta consultando. El usuario decide su contenido; el
  // esqueleto de avances siempre monta los chips (data-phase) al cargar.
  React.useEffect(() => {
    if (faseInicial === undefined || !session) return;
    const t1 = window.setTimeout(function () {
      const el = document.querySelector('[data-phase="' + String(faseInicial) + '"]') as HTMLElement | null;
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('phase-focus');
        window.setTimeout(function () { el.classList.remove('phase-focus'); }, 2600);
      }
    }, 600);
    return function () { window.clearTimeout(t1); };
  }, [faseInicial, session]);
  // Solo auto-scroll al fondo del chat si el usuario ya estaba cerca del
  // final (mientras Babel responde o al enviar un mensaje).
  React.useEffect(() => {
    if (!nearBottomRef.current) return;
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session?.messages.length]);
  React.useEffect(() => {
    if (!session || isPhase0Complete) return;
    if (session.messages.length === 0 && currentQuestionIndex === 0) {
      const firstQuestion = questions[0];
      const questionMsg: ChatMessage = {
        role: 'assistant',
        content: fase0IntroText(dispLang) + firstQuestion.question,
        timestamp: Timestamp.now(),
      };
      // session.messages se siembra una sola vez cuando la sesion llega vacia;
      // session sigue siendo la fuente unica de verdad consumida por el resto
      // del componente (render, saveBabelMessages), no un valor derivable en render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSession(prev => prev ? { ...prev, messages: [questionMsg] } : prev);
    }
  }, [session, currentQuestionIndex, isPhase0Complete, questions, dispLang]);
  const currentPhase = session?.currentPhase ?? 0;
  const allPhasesDone = currentPhase >= BABEL_IMPLEMENTED_PHASES;
  const phaseTopics = babelPhaseTopics(dispLang);
  const currentPhaseTopic = currentPhase < BABEL_IMPLEMENTED_PHASES ? phaseTopics[currentPhase] : null;
  const lastMessage = session?.messages[session.messages.length - 1];
  const awaitingApproval =
    !allPhasesDone &&
    !!lastMessage &&
    lastMessage.role === 'assistant' &&
    lastMessage.content.includes(babelApprovalMarker(locale));
  // Traduccion en vivo (por IA real, no Google Translate) del contenido que
  // Babel ya genero, para cuando el usuario ve la pagina en un idioma
  // distinto al de la ruta. Solo se traducen mensajes de Babel (no las
  // respuestas propias del usuario, ni el par de resumen de Fase 0, que ya
  // se reconstruye localmente sin IA).
  const sessionLocale = (session as any)?.locale ?? 'es';
  React.useEffect(() => {
    if (!session || dispLang === sessionLocale) return;
    session.messages.forEach(function (m, i) {
      if (m.role !== 'assistant') return;
      if (currentPhase === 0 && i <= 1) return;
      const cacheKey = i + '::' + dispLang;
      if (translatedCache[cacheKey] !== undefined) return;
      if (translatingSet.has(i)) return;
      setTranslatingSet(function (prev) { const next = new Set(prev); next.add(i); return next; });
      fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: m.content, targetLang: dispLang }),
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          const translated = data && typeof data.translation === 'string' ? data.translation : m.content;
          setTranslatedCache(function (prev) {
            const next = { ...prev };
            next[cacheKey] = translated;
            return next;
          });
        })
        .catch(function () {
          setTranslatedCache(function (prev) {
            const next = { ...prev };
            next[cacheKey] = m.content;
            return next;
          });
        })
        .finally(function () {
          setTranslatingSet(function (prev) {
            const next = new Set(prev);
            next.delete(i);
            return next;
          });
        });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispLang, session?.messages, locale, currentPhase]);
  const phaseTemplate = function (phase: number): string {
    if (phase <= 0) return '';
    const templates: Record<number, string> = {
      1: '### 1. Circulo Dorado\n\n**Why (Proposito):** \n\n**How (Diferenciacion):** \n\n**What (Que vendes):** \n\n---\n\n### 2. ODS y Fondos\n\n**ODS vinculados:** \n\n**Fondos sugeridos:** \n\n---\n\n### 3. Propuesta de Valor (Jobs-to-be-Done)\n\n**Beneficios funcionales:** \n\n**Beneficios emocionales:** \n\n**Beneficios sociales:** \n\n---\n\n### 4. Segmentacion de clientes\n\n**Arquetipo 1:** \n\n**Oceano Azul:** \n\n**Impacto social:**',
      2: '### 1. Analisis PESTEL Localizado\n\n**Politico:** \n\n**Economico:** \n\n**Social:** \n\n**Tecnologico:** \n\n**Ecologico:** \n\n**Legal:** \n\n---\n\n### 2. Fuerzas del Mercado\n\n**Panorama competitivo:** \n\n**Nuevos entrantes:** \n\n**Sustitutos:** \n\n**Proveedores:** \n\n---\n\n### 3. Matriz de Impacto en Stakeholders\n\n**Colaboradores:** \n\n**Accionistas:** \n\n**Clientes:** \n\n**Proveedores:** \n\n**Medio ambiente:** \n\n**Sociedad:** \n\n**Gobierno:**',
      3: '### 1. Capacidades Clave\n\n**Capacidades basicas:** \n\n**Capacidades diferenciadoras:** \n\n---\n\n### 2. Plan Operativo\n\n**Infraestructura:** \n\n**Cadena de suministro:** \n\n**Personal requerido:** \n\n**Insumos fijos:**',
      4: '### 1. Prospectiva Estrategica a 5 Anos\n\n**Incertidumbres criticas:** \n\n**Escenarios de Peter Schwartz:** \n\n**Configuracion morfologica disruptiva:** \n\n**Backcasting (de hoy a 5 anos):** \n\n---\n\n### 2. Estrategia enfocada al Cliente (Modelo Delta)\n\n**Estrategia seleccionada:** \n\n**Customer Journey:** \n\n**Fricciones y oportunidades:**',
    };
    return templates[phase] ?? '### Escribe aqui tu analisis para esta fase...';
  };
  function friendlyError(raw: string): string {
    if (raw.includes('image.png')) {
      return 'Error de formato al contactar la IA. Revisa que las API keys en Vercel sean validas (Groq, OpenRouter, Gemini). Detalle: ' + raw.slice(0, 300);
    }
    return raw;
  }

  React.useEffect(() => {
    if (session && (session.currentPhase ?? 0) > 0) {
      // isPhase0Complete se sincroniza cuando una sesion existente carga con
      // fase ya avanzada (usuario que regresa); isPhase0Complete tambien se
      // escribe desde varios manejadores de eventos, no es un valor derivable.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsPhase0Complete(true);
    }
  }, [session]);
  async function handlePhase0Answer() {
    if (!input.trim() || !uid || !session) return;
    const answer = input.trim();
    setInput('');
    setSending(true);
    setError(null);
    const userMsg: ChatMessage = {
      role: 'user',
      content: answer,
      timestamp: Timestamp.now(),
    };
    try {
      const updatedAnswers = { ...phase0Answers, [questions[currentQuestionIndex].key]: answer };
      setPhase0Answers(updatedAnswers);
      if (currentQuestionIndex === questions.length - 1) {
        const built = buildFase0Summary(updatedAnswers, locale);
        const summaryMsg: ChatMessage = {
          role: 'user',
          content: built.userContent,
          timestamp: Timestamp.now(),
        };
        const assistantMsg: ChatMessage = {
          role: 'assistant',
          content: built.assistantContent,
          timestamp: Timestamp.now(),
        };
        const cleanMessages: ChatMessage[] = [summaryMsg, assistantMsg];
        setSession(function (prev) { return prev ? { ...prev, messages: cleanMessages } : prev; });
        await saveBabelMessages(uid, cleanMessages);
        setIsPhase0Complete(true);
      } else {
        const updatedMessages = [...session.messages, userMsg];
        setSession(function (prev) { return prev ? { ...prev, messages: updatedMessages } : prev; });
        const nextIndex = currentQuestionIndex + 1;
        setCurrentQuestionIndex(nextIndex);
        const nextQuestion = questions[nextIndex];
        const nextQuestionMsg: ChatMessage = {
          role: 'assistant',
          content: nextQuestion.question,
          timestamp: Timestamp.now(),
        };
        const messagesWithNextQuestion = [...updatedMessages, nextQuestionMsg];
        setSession(function (prev) { return prev ? { ...prev, messages: messagesWithNextQuestion } : prev; });
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Error al procesar';
      setError(errMsg);
      if (currentQuestionIndex === questions.length - 1) {
        const finalAnswers = { ...phase0Answers, [questions[currentQuestionIndex].key]: input.trim() };
        const built = buildFase0Summary(finalAnswers, locale);
        const summaryMsg: ChatMessage = {
          role: 'user',
          content: built.userContent,
          timestamp: Timestamp.now(),
        };
        const allMessages = [...session.messages, userMsg, summaryMsg];
        const retryBody = {
          messages: allMessages,
          language: locale,
          phase: 0,
          phase0Complete: true,
          phase0Data: finalAnswers,
        };
        retryRef.current = async function () {
          setSending(true);
          setError(null);
          try {
            const res = await fetch('/api/babel', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(retryBody),
            });
            const data = await res.json();
            if (!res.ok || data.error) throw new Error(data.error || 'Error al procesar Fase 0');
            retryRef.current = null;
            const assistantMsg: ChatMessage = {
              role: 'assistant',
              content: data.reply as string,
              timestamp: Timestamp.now(),
            };
            const cleanMessages: ChatMessage[] = [summaryMsg, assistantMsg];
            setSession(function (prev) { return prev ? { ...prev, messages: cleanMessages } : prev; });
            await saveBabelMessages(uid, cleanMessages);
            setIsPhase0Complete(true);
          } catch (retryErr) {
            setError(retryErr instanceof Error ? retryErr.message : 'Error al procesar');
          } finally {
            setSending(false);
          }
        };
      }
    } finally {
      setSending(false);
    }
  }
  async function sendMessage(text: string) {
    if (!uid || !session || !text.trim()) return;
    setSending(true);
    setError(null);
    retryRef.current = null;
    const userMsg: ChatMessage = {
      role: 'user',
      content: text.trim(),
      timestamp: Timestamp.now(),
    };
    const historyForApi = [...session.messages, userMsg];
    setSession({ ...session, messages: historyForApi });
    const sentText = text.trim();
    setInput('');
    const payload = {
      messages: historyForApi.map(function (m) { return { role: m.role, content: m.content }; }),
      language: locale,
      phase: currentPhase,
    };
    try {
      const res = await fetch('/api/babel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Error generico');
      retryRef.current = null;
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: data.reply as string,
        timestamp: Timestamp.now(),
      };
      const finalMessages = [...historyForApi, assistantMsg];
      setSession(function (prev) { return prev ? { ...prev, messages: finalMessages } : prev; });
      await saveBabelMessages(uid, finalMessages);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Error generico';
      setError(errMsg);
      retryRef.current = async function () {
        setSending(true);
        setError(null);
        try {
          const res = await fetch('/api/babel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
      const data = await res.json();
      if (!res.ok || data.error) {
        console.error('[babel] API error response completa:', JSON.stringify(data, null, 2));
        throw new Error(data.error || 'Error generico');
      }
          retryRef.current = null;
          const assistantMsg: ChatMessage = {
            role: 'assistant',
            content: data.reply as string,
            timestamp: Timestamp.now(),
          };
          const finalMessages = [...historyForApi, assistantMsg];
          setSession(function (prev) { return prev ? { ...prev, messages: finalMessages } : prev; });
          await saveBabelMessages(uid, finalMessages);
        } catch (retryErr) {
          setError(retryErr instanceof Error ? retryErr.message : 'Error generico');
        } finally {
          setSending(false);
        }
      };
    } finally {
      setSending(false);
    }
  }
  async function handleApprove(editedText?: string) {
    if (!uid || !session || !lastMessage) return;
    setSending(true);
    setError(null);
    setEditingMessageIndex(null);
    const approvedContent = editedText ?? lastMessage.content;
    try {
      await approveBabelPhase(uid, currentPhase, approvedContent, locale);
      const refreshed = await getOrCreateBabelSession(uid, locale);
      if ((refreshed.currentPhase ?? 0) >= BABEL_IMPLEMENTED_PHASES) {
        setSession(refreshed);
        setSending(false);
        setCompiling(true);
        await upsertCompiledPlan(refreshed.messages, refreshed.phases);
        setCompiling(false);
        return;
      }
      const approvalMsg: ChatMessage = {
        role: 'user',
        content: locale === 'en' ? "I approve, let's continue." : 'Apruebo, continuemos.',
        timestamp: Timestamp.now(),
      };
      const historyForApi = [...refreshed.messages, approvalMsg];
      const res = await fetch('/api/babel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: historyForApi.map(function (m) { return { role: m.role, content: m.content }; }),
          language: locale,
          phase: refreshed.currentPhase,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        console.error('[babel] API error response completa:', JSON.stringify(data, null, 2));
        throw new Error(data.error || 'Error generico');
      }
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: data.reply as string,
        timestamp: Timestamp.now(),
      };
      const finalMessages = [...refreshed.messages, assistantMsg];
      setSession({ ...refreshed, messages: finalMessages });
      await saveBabelMessages(uid, finalMessages);
      if ((refreshed.currentPhase ?? 0) >= BABEL_IMPLEMENTED_PHASES) {
      await upsertCompiledPlan(finalMessages, refreshed.phases);
      }
      } catch (err) {
      const refreshedCatch = await getOrCreateBabelSession(uid, locale);
      setError(err instanceof Error ? err.message : 'Error generico');
      setShowManualEditor(true);
      setManualContent(phaseTemplate(refreshedCatch.currentPhase ?? 0));
      setSession(refreshedCatch);
    } finally {
      setSending(false);
    }
  }
  function handleStartEdit(index: number, content: string) {
    setEditingMessageIndex(index);
    setEditContent(content);
  }
  function handleCancelEdit() {
    setEditingMessageIndex(null);
    setEditContent('');
  }
  async function handleSaveEdit() {
    if (!uid || !session || editingMessageIndex === null) return;
    setError(null);
    try {
      const originalContent = session.messages[editingMessageIndex]?.content ?? '';
      const updatedMessages = session.messages.map(function (m, i) {
        return i === editingMessageIndex ? { ...m, content: editContent } : m;
      });
      await saveBabelMessages(uid, updatedMessages);
      for (const p of session.phases ?? []) {
        if (p.summary === originalContent || originalContent.startsWith(p.summary) || p.summary.startsWith(originalContent)) {
          await updateBabelPhaseSummary(uid, p.phase, editContent);
        }
      }
      setEditingMessageIndex(null);
      setEditContent('');
      const refreshed = await getOrCreateBabelSession(uid, locale);
      setSession(refreshed);
      await upsertCompiledPlan(refreshed.messages, refreshed.phases);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    }
  }
  async function manualApprovePhase(phase: number, text: string) {
    if (!uid || !session) return;
    setSending(true);
    setError(null);
    setShowManualEditor(false);
    try {
      await approveBabelPhase(uid, phase, text, locale);
      const refreshed = await getOrCreateBabelSession(uid, locale);
      const isLastPhase = phase >= BABEL_IMPLEMENTED_PHASES - 1;
      const nextPhaseContent = text + (isLastPhase ? '' : '\n\n' + babelApprovalMarker(locale));
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: nextPhaseContent,
        timestamp: Timestamp.now(),
      };
      const finalMessages = [...refreshed.messages, assistantMsg];
      setSession({ ...refreshed, messages: finalMessages });
      await saveBabelMessages(uid, finalMessages);
      setManualContent('');
      if (isLastPhase) {
      await upsertCompiledPlan(finalMessages, refreshed.phases);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSending(false);
    }
  }
  async function upsertCompiledPlan(overrideMessages?: ChatMessage[], overridePhases?: BabelPhaseRecord[]) {
    if (!uid || !session) return;
    try {
      const phases = overridePhases ?? session.phases ?? [];
      const compiled = phases.length > 0 ? [...phases].sort((a, b) => a.phase - b.phase).map((p) => p.summary).join('\n\n---\n\n') : '';
      const compiledText = compiled ? '### Plan Estrategico Compilado\n\n' + compiled : 'No hay fases aprobadas para compilar aun.';
      const baseMessages = overrideMessages ?? session.messages;
      let existingIdx = -1;
      for (let j = baseMessages.length - 1; j >= 0; j--) {
        if (baseMessages[j].role === 'assistant' && baseMessages[j].content.startsWith('### Plan Estrategico Compilado')) {
          existingIdx = j;
          break;
        }
      }
      if (compiled) {
        try {
          await downloadCompiledPlanPdf({ sessionTopic: session.topic, compiledText: compiled, language: locale });
        } catch (pdfErr) {
          console.error('[babel] No se pudo generar el PDF del plan compilado', pdfErr);
        }
      }
      let finalMessages: ChatMessage[];
      if (existingIdx >= 0) {
        finalMessages = baseMessages.map(function (m, i) {
          return i === existingIdx ? { ...m, content: compiledText } : m;
        });
      } else {
        const assistantMsg: ChatMessage = { role: 'assistant', content: compiledText, timestamp: Timestamp.now() };
        finalMessages = [...baseMessages, assistantMsg];
      }
      setSession(function (prev) { return prev ? { ...prev, messages: finalMessages } : prev; });
      setInput('');
    } catch (err) {
      console.error('[babel] Error en upsertCompiledPlan:', err);
      throw err;
    }
  }
  async function handleCompile() {
    if (!uid || !session || compiling) return;
    setCompiling(true);
    setError(null);
    try {
      await upsertCompiledPlan();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al compilar');
    } finally {
      setCompiling(false);
    }
  }
  async function handleReset() {
    if (!uid) return;
    const confirmMsg =
      dispLang === 'en'
        ? 'This will erase all progress in this session and start over from scratch. This cannot be undone. Continue?'
        : 'Esto borrara todo el progreso de esta sesion y empezara de nuevo desde cero. No se puede deshacer. Continuar?';
    if (!window.confirm(confirmMsg)) return;
    setSending(true);
    setError(null);
    try {
      const fresh = await resetBabelSession(uid, locale);
      setSession(fresh);
      setInput('');
      setCurrentQuestionIndex(0);
      setPhase0Answers({});
      setIsPhase0Complete(false);
      setTranslatedCache({});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al reiniciar');
    } finally {
      setSending(false);
    }
  }
  const pasosTour: TourStep[] = [
    {
      selector: '#babel-titulo',
      title: dispLang === 'en' ? 'Strategic Reflection' : 'Reflexión Estratégica',
      description: dispLang === 'en'
        ? 'Talk to Babel, your strategic agent: each approved phase becomes input for your business plan.'
        : 'Conversa con Babel, tu agente estratégico: cada fase aprobada se convierte en insumos de tu plan de negocio.',
    },
    {
      selector: '#babel-chat',
      title: dispLang === 'en' ? 'The conversation' : 'La conversación',
      description: dispLang === 'en'
        ? 'Read Babel responses and edit any message with the pencil before approving the phase.'
        : 'Lee las respuestas de Babel y edita cualquier mensaje con el lápiz antes de aprobar la fase.',
    },
    {
      selector: '#babel-entrada',
      title: dispLang === 'en' ? 'Answer Babel' : 'Responde a Babel',
      description: dispLang === 'en'
        ? 'Type your answer here. Once you complete the 5 phases, use /compilar to build the full plan as PDF.'
        : 'Escribe tu respuesta aquí. Cuando completes las 5 fases, usa /compilar para armar el plan completo en PDF.',
    },
  ];
  if (!session) {
    return <div className="flex min-h-[60vh] items-center justify-center text-slate-500">{dispLang === locale ? t('loading') : UI_FALLBACK[dispLang].loading}</div>;
  }
  const isPhase0Active = currentPhase === 0 && currentQuestionIndex < questions.length && !isPhase0Complete;
  if (isPhase0Active) {
    return (
      <React.Fragment>
      <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4 sm:p-6">
        {faseInicial !== undefined && <FaseBanner fase={faseInicial} lang={dispLang} locale={locale} />}
        <div id="babel-titulo" className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-3">
            <AgentAvatar size={56} className="shrink-0" />
            <div>
              <h1 className="text-xl font-semibold text-slate-900">{dispLang === locale ? t('title') : UI_FALLBACK[dispLang].title}</h1>
              <p className="text-sm text-slate-500">{dispLang === 'en' ? 'Phase 0: Initial Calibration' : 'Fase 0: Calibración Inicial'}</p>
            </div>
          </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-2">
            <Button onClick={handleReset} disabled={sending} variant="outline" size="sm">{dispLang === 'en' ? 'Start over' : 'Empezar de nuevo'}</Button>
          </div>
        </div>
      </div>
      {faseInicial !== 0 && <PhaseStepper currentPhase={currentPhase} approved={session.phases ?? []} lang={dispLang} />}
      {currentQuestionIndex > 0 && (
          <div id="babel-chat" className="glass-panel flex-1 space-y-3 overflow-y-auto p-4 max-h-[40vh]">
            {Array.from({ length: currentQuestionIndex }).map(function (_unused, k) {
              const qText = (k === 0 ? fase0IntroText(dispLang) : '') + questions[k].question;
              const answerText = phase0Answers[questions[k].key] ?? '';
              return (
                <React.Fragment key={k}>
                  <div className="max-w-[85%] rounded-xl bg-slate-100 px-3.5 py-2 text-sm text-slate-900 whitespace-pre-wrap">
                    {limpiarMarkdown(qText)}
                  </div>
                  <div className="ml-auto max-w-[85%] rounded-xl bg-slate-900 px-3.5 py-2 text-sm text-white whitespace-pre-wrap">
                    {answerText}
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        )}
        <div className="w-full bg-slate-200 rounded-full h-2">
          <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: String(((currentQuestionIndex + 1) / questions.length) * 100) + '%' }} />
        </div>
        <p className="text-sm text-slate-600">
          {dispLang === 'en' ? 'Question' : 'Pregunta'} {currentQuestionIndex + 1} {dispLang === 'en' ? 'of' : 'de'} {questions.length}
        </p>
        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 border border-red-200">
            <div className="mb-1">{friendlyError(error)}</div>
            <div className="mt-2 flex gap-2">
              {retryRef.current && (
                <button
                  onClick={function () { if (retryRef.current) retryRef.current(); }}
                  disabled={sending}
                  className="text-xs font-medium text-red-700 underline underline-offset-2 hover:text-red-900 disabled:opacity-50"
                >
                  {sending ? (dispLang === 'en' ? 'Retrying...' : 'Reintentando...') : (dispLang === 'en' ? 'Retry' : 'Reintentar')}
                </button>
              )}
              {currentQuestionIndex === questions.length - 1 && !showManualEditor && (
                <button
                  onClick={function () { setShowManualEditor(true); }}
                  className="text-xs font-medium text-blue-700 underline underline-offset-2 hover:text-blue-900"
                >
                  {dispLang === 'en' ? 'Write my own conclusion' : 'Escribir mi propia conclusion'}
                </button>
              )}
            </div>
          </div>
        )}
        {showManualEditor && (
          <div className="glass-panel p-4 space-y-2">
            <p className="text-sm font-medium text-slate-700">{dispLang === 'en' ? 'Write your Phase 0 conclusion manually:' : 'Escribe tu conclusion de la Fase 0 manualmente:'}</p>
            <textarea
              value={manualContent}
              onChange={function (e) { setManualContent(e.target.value); }}
              rows={10}
              placeholder={dispLang === 'en' ? 'Describe your business summary here...' : 'Describe aqui el resumen de tu negocio...'}
              className="w-full resize-y rounded border border-slate-300 bg-white p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-2">
              <Button onClick={function () { setShowManualEditor(false); setManualContent(''); }} variant="outline" size="sm">
                {dispLang === 'en' ? 'Cancel' : 'Cancelar'}
              </Button>
              <Button onClick={function () { manualApprovePhase(0, manualContent); }} disabled={sending || !manualContent.trim()} size="sm">
                {sending ? (dispLang === 'en' ? 'Saving...' : 'Guardando...') : (dispLang === 'en' ? 'Save and approve Phase 0' : 'Guardar y aprobar Fase 0')}
              </Button>
            </div>
          </div>
        )}
        <div id="babel-entrada" className="glass-panel p-6">
          <div className="whitespace-pre-wrap text-slate-900 mb-4 font-medium">
            {questions[currentQuestionIndex].question}
          </div>
          <form
            onSubmit={function (e) {
              e.preventDefault();
              handlePhase0Answer();
            }}
            className="flex gap-2 items-end"
          >
            <textarea
              value={input}
              onChange={function (e) { setInput(e.target.value); }}
              onKeyDown={function (e) {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                }
              }}
              placeholder={dispLang === 'en' ? 'Type your answer here...' : 'Escribe tu respuesta aqui...'}
              disabled={sending}
              rows={3}
              className="flex-1 resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 min-h-[80px]"
            />
            <Button type="submit" disabled={sending || !input.trim()} className="mb-0 h-10">
              {sending ? (dispLang === 'en' ? 'Sending...' : 'Enviando...') : (dispLang === locale ? t('send') : UI_FALLBACK[dispLang].send)}
            </Button>
          </form>
        </div>
      </div>
      <PageTour pageId="babel-reflexion" steps={pasosTour} lang={dispLang} />
      </React.Fragment>
    );
  }
  // Página de Calibración (fase 0): NUNCA muestra las fases posteriores.
  // Completada la Fase 0, el usuario continúa cada fase en su propia página
  // (/babel/proposito, /babel/entorno, /babel/capacidades, /babel/enfoque).
  if (faseInicial === 0) {
    const pasosCalibracion: TourStep[] = [
      {
        selector: '#babel-calibracion-portal',
        title: dispLang === 'en' ? 'Calibration completed' : 'Calibración completada',
        description: dispLang === 'en'
          ? 'Your Phase 0 summary is saved here. Tap any section of this box and I will explain it.'
          : 'Tu resumen de la Fase 0 quedó guardado aquí. Toca cualquier sección de esta caja y te la explico.',
      },
      {
        selector: '#babel-calibracion-siguiente',
        title: dispLang === 'en' ? 'Keep going' : 'Continúa tu camino',
        description: dispLang === 'en'
          ? 'Each phase lives in its own page: continue to Phase 1 (Purpose) or open the full Strategic Reflection.'
          : 'Cada fase vive en su propia página: continúa con la Fase 1 (Propósito) o abre la Reflexión Estratégica completa.',
      },
    ];
    return (
      <React.Fragment>
        <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4 sm:p-6">
          <FaseBanner fase={0} lang={dispLang} locale={locale} />
          <div id="babel-titulo" className="flex items-center gap-3 border-b pb-4">
            <AgentAvatar size={56} className="shrink-0" />
            <div>
              <h1 className="text-xl font-semibold text-slate-900">{dispLang === locale ? t('title') : UI_FALLBACK[dispLang].title}</h1>
              <p className="text-sm text-slate-500">{dispLang === 'en' ? 'Phase 0: Initial Calibration' : 'Fase 0: Calibración Inicial'}</p>
            </div>
          </div>
          <div id="babel-calibracion-portal" className="glass-panel flex flex-col gap-4 p-6">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="text-5xl">🎉</div>
              <h2 className="text-xl font-semibold text-slate-900">{dispLang === 'en' ? 'Phase 0 completed' : 'Fase 0 completada'}</h2>
              <p className="text-sm text-slate-600">
                {dispLang === 'en'
                  ? 'Your initial calibration is ready. Each remaining phase lives in its own page — continue there.'
                  : 'Tu calibración inicial quedó lista. Cada fase restante vive en su propia página — continúa ahí.'}
              </p>
            </div>
            <div id="babel-chat" className="max-h-[40vh] flex-1 space-y-3 overflow-y-auto rounded-xl border border-slate-200 bg-white/60 p-4 dark:border-slate-700 dark:bg-white/5">
              {session.messages.slice(0, 2).map(function (m, i) {
                const limpio = limpiarMarkdown(m.content);
                const displayContent =
                  i === 0
                    ? limpio.replace(/^Fase 0 completada:\s*/i, '').replace(/^Phase 0 completed:\s*/i, '')
                    : limpio;
                const isLong = displayContent.length > 300;
                const isExpanded = chatExpanded.has(i);
                return (
                  <div
                    key={i}
                    className={'max-w-[85%] rounded-xl px-3.5 py-2 text-sm ' + (m.role === 'user' ? 'ml-auto bg-slate-900 text-white' : 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100')}
                  >
                    {editingMessageIndex === i ? (
                      <div className="space-y-2">
                        <textarea
                          value={editContent}
                          onChange={function (e) { setEditContent(e.target.value); }}
                          rows={12}
                          className="w-full resize-y rounded border border-blue-300 bg-white p-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={handleCancelEdit} disabled={sending}>
                            {dispLang === 'en' ? 'Cancel' : 'Cancelar'}
                          </Button>
                          <Button size="sm" onClick={handleSaveEdit} disabled={sending || !editContent.trim()}>
                            {sending ? (dispLang === 'en' ? 'Saving...' : 'Guardando...') : (dispLang === 'en' ? 'Save' : 'Guardar')}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className={'whitespace-pre-wrap ' + (isLong && !isExpanded ? 'max-h-32 overflow-y-auto' : '')}>{displayContent}</div>
                    )}
                    {isLong && !(editingMessageIndex === i) && (
                      <div className="mt-1 flex gap-3">
                        <button
                          onClick={function () {
                            setChatExpanded(function (prev) {
                              const next = new Set(prev);
                              if (next.has(i)) { next.delete(i); } else { next.add(i); }
                              return next;
                            });
                          }}
                          className="text-xs font-medium text-blue-600 underline underline-offset-2 hover:text-blue-800"
                        >
                          {isExpanded ? (dispLang === 'en' ? 'See less' : 'Ver menos') : (dispLang === 'en' ? 'See all' : 'Ver todo')}
                        </button>
                        {m.role === 'assistant' && (
                          <button
                            onClick={function () { handleStartEdit(i, m.content); }}
                            className="text-xs font-medium text-blue-600 underline underline-offset-2 hover:text-blue-800"
                          >
                            {dispLang === 'en' ? 'Edit' : 'Editar'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div id="babel-calibracion-siguiente" className="mt-2 flex flex-wrap items-center justify-center gap-2">
              <a
                href={`/${locale}/babel/proposito`}
                className="rounded-lg bg-gradient-to-r from-teal-500 to-cyan-400 px-4 py-2 text-sm font-extrabold text-white shadow-md shadow-teal-500/30 transition hover:opacity-90"
              >
                {dispLang === 'en' ? 'Continue to Phase 1 — Purpose & Value Proposition →' : 'Continuar a la Fase 1 — Propósito y Propuesta de Valor →'}
              </a>
              <a
                href={`/${locale}/babel`}
                className="rounded-lg border border-teal-400/60 bg-white/40 px-4 py-2 text-sm font-bold text-teal-700 backdrop-blur-md transition hover:bg-white/70 dark:bg-white/10 dark:text-teal-200 dark:hover:bg-white/20"
              >
                {dispLang === 'en' ? 'Open the full Strategic Reflection' : 'Abrir la Reflexión Estratégica completa'}
              </a>
            </div>
          </div>
        </div>
        <PageTour pageId="babel-calibracion" steps={pasosCalibracion} lang={dispLang} />
      </React.Fragment>
    );
  }
  const rangoFase = faseInicial !== undefined && faseInicial >= 1 ? rangoDeFase(session, faseInicial) : null;
  const faseCompletada = faseInicial !== undefined && (session.phases ?? []).some(function (p) { return p.phase === faseInicial && p.approved; });
  const RUTA_SIGUIENTE_FASE: Record<number, string> = { 1: 'entorno', 2: 'capacidades', 3: 'enfoque' };
  return (
    <React.Fragment>
    <div className="mx-auto flex max-w-4xl flex-col gap-4 p-4 sm:p-6">
      {faseInicial !== undefined && <FaseBanner fase={faseInicial} lang={dispLang} locale={locale} />}
      <div id="babel-titulo" className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <AgentAvatar size={56} className="shrink-0" />
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{dispLang === locale ? t('title') : UI_FALLBACK[dispLang].title}</h1>
            <p className="text-sm text-slate-500">
              {faseInicial !== undefined && phaseTopics[faseInicial]
                ? phaseTopics[faseInicial]
                : currentPhaseTopic ??
                  (dispLang === 'en'
                    ? 'All phases completed — compile your full plan with /compilar'
                    : 'Todas las fases completadas — compila tu plan completo con /compilar')}
          </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-2">
            <Button onClick={handleReset} disabled={sending} variant="outline" size="sm">{dispLang === 'en' ? 'Start over' : 'Empezar de nuevo'}</Button>
          </div>
        </div>
      </div>
      <PhaseStepper currentPhase={currentPhase} approved={session.phases ?? []} lang={dispLang} solo={rangoFase ? faseInicial : null} />
      {rangoFase && !rangoFase.alcanzada ? (
        <div className="glass-panel flex flex-col items-center gap-3 p-8 text-center text-sm text-slate-600 dark:text-slate-300">
          <div className="text-4xl">🔒</div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {dispLang === 'en' ? 'This phase is not unlocked yet' : 'Esta fase aún no está desbloqueada'}
          </h2>
          <p className="max-w-md">
            {dispLang === 'en'
              ? 'Complete the previous phases of the Strategic Reflection to unlock Fase ' + faseInicial + '.'
              : 'Completa las fases anteriores de la Reflexión Estratégica para desbloquear la Fase ' + faseInicial + '.'}
          </p>
          <a
            href={'/' + locale + '/babel'}
            className="rounded-lg border border-teal-400/60 bg-white/40 px-4 py-2 text-xs font-bold text-teal-700 backdrop-blur-md transition hover:bg-white/70 dark:bg-white/10 dark:text-teal-200 dark:hover:bg-white/20"
          >
            {dispLang === 'es' ? '← Volver a la Reflexión Estratégica' : '← Back to Strategic Reflection'}
          </a>
        </div>
      ) : (
      <div id="babel-chat" className="glass-panel flex-1 space-y-3 overflow-y-auto p-4 min-h-[60vh]">
        {Array.from({ length: rangoFase ? rangoFase.fin - rangoFase.inicio + 1 : session.messages.length }).map(function (_unused, k) {
          const i = rangoFase ? rangoFase.inicio + k : k;
          const m = session.messages[i] as ChatMessage;
          const isStoredPhase0SummaryUser =
            m.role === 'user' && (m.content.startsWith('Fase 0 completada:') || m.content.startsWith('Phase 0 completed:'));
          if (isStoredPhase0SummaryUser) return null;
          const isFase0SummaryPair = currentPhase === 0 && i <= 1 && Object.keys(phase0Answers).length > 0;
          if (isFase0SummaryPair && i === 0) return null;
          const translationKey = i + '::' + dispLang;
          const isTranslatable = m.role === 'assistant' && !isFase0SummaryPair && dispLang !== sessionLocale;
          const hasTranslation = isTranslatable && translatedCache[translationKey] !== undefined;
          const isTranslatingThis = isTranslatable && !hasTranslation && translatingSet.has(i);
          const displayContent = isFase0SummaryPair
            ? (i === 0 ? buildFase0Summary(phase0Answers, dispLang).userContent : buildFase0Summary(phase0Answers, dispLang).assistantContent)
            : hasTranslation
              ? translatedCache[translationKey]
              : m.content;
          const isLong = displayContent.length > 300;
          const isExpanded = chatExpanded.has(i);
          return (
            <div key={i} className={'max-w-[85%] rounded-xl px-3.5 py-2 text-sm ' + (m.role === 'user' ? 'ml-auto bg-slate-900 text-white' : 'bg-slate-100 text-slate-900')}>
              {editingMessageIndex === i ? (
                <div className="space-y-2">
                  <textarea
                    value={editContent}
                    onChange={function (e) { setEditContent(e.target.value); }}
                    rows={12}
                    className="w-full resize-y rounded border border-blue-300 bg-white p-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={handleCancelEdit} disabled={sending}>{dispLang === 'en' ? 'Cancel' : 'Cancelar'}</Button>
                    <Button size="sm" onClick={handleSaveEdit} disabled={sending || !editContent.trim()}>
                      {sending ? (dispLang === 'en' ? 'Saving...' : 'Guardando...') : (dispLang === 'en' ? 'Save' : 'Guardar')}
                    </Button>
                  </div>
                </div>
              ) : (
                m.role === 'assistant' ? (
                  <div className={isLong && !isExpanded ? 'max-h-32 overflow-y-auto' : ''}>
                    {isFase0SummaryPair ? (
                      <div className="whitespace-pre-wrap">{limpiarMarkdown(displayContent)}</div>
                    ) : (
                      <MarkdownMessage content={displayContent} />
                    )}
                  </div>
                ) : (
                  <div className={'whitespace-pre-wrap ' + (isLong && !isExpanded ? 'max-h-32 overflow-y-auto' : '')}>
                    {displayContent}
                  </div>
                )
              )}
              {isTranslatingThis && (
                <div className="mt-1 text-xs italic text-slate-400">
                  {dispLang === 'en' ? 'Translating...' : 'Traduciendo...'}
                </div>
              )}
              {isLong && !(editingMessageIndex === i) && (
                <div className="mt-1 flex gap-3">
                  <button
                    onClick={function () {
                      setChatExpanded(function (prev) {
                        const next = new Set(prev);
                        if (next.has(i)) { next.delete(i); } else { next.add(i); }
                        return next;
                      });
                    }}
                    className="text-xs font-medium text-blue-600 hover:text-blue-800 underline underline-offset-2"
                  >
                    {isExpanded ? (dispLang === 'en' ? 'See less' : 'Ver menos') : (dispLang === 'en' ? 'See all' : 'Ver todo')}
                  </button>
                  {m.role === 'assistant' && !isFase0SummaryPair && !hasTranslation && !m.content.startsWith('### Plan Estrategico Compilado') && (
                    <button
                      onClick={function () { handleStartEdit(i, m.content); }}
                      className="text-xs font-medium text-blue-600 hover:text-blue-800 underline underline-offset-2"
                    >
                      {dispLang === 'en' ? 'Edit' : 'Editar'}
                    </button>
                  )}
                </div>
              )}
              {m.deliverables && m.deliverables.length > 0 && (
                <div className="mt-2 flex flex-col gap-1 border-t border-slate-200 pt-2">
                  {m.deliverables.map(function (d, di) {
                    return (
                      <a key={di} href={d.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 underline underline-offset-2 hover:text-blue-900">
                        {dispLang === locale ? t('downloadDeliverable') : UI_FALLBACK[dispLang].downloadDeliverable}: {d.name}
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        {sending && (
          <div className="max-w-[85%] rounded-xl bg-slate-100 px-3.5 py-2 text-sm text-slate-500 animate-pulse">
            {dispLang === locale ? t('loadingReply') : UI_FALLBACK[dispLang].loadingReply}
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      )}
      {rangoFase && faseCompletada && (
        <div className="flex justify-center">
          <a
            href={'/' + locale + (faseInicial >= BABEL_IMPLEMENTED_PHASES - 1 ? '/babel' : '/babel/' + (RUTA_SIGUIENTE_FASE[faseInicial ?? 1] ?? ''))}
            className="rounded-lg bg-gradient-to-r from-teal-500 to-cyan-400 px-4 py-2 text-sm font-extrabold text-white shadow-md shadow-teal-500/30 transition hover:opacity-90"
          >
            {faseInicial >= BABEL_IMPLEMENTED_PHASES - 1
              ? (dispLang === 'en' ? 'Open your complete plan →' : 'Ver tu plan completo →')
              : (dispLang === 'en'
                  ? 'Continue to Phase ' + ((faseInicial ?? 0) + 1) + ' →'
                  : 'Continuar a la Fase ' + ((faseInicial ?? 0) + 1) + ' →')}
          </a>
        </div>
      )}
      {(!rangoFase || rangoFase.alcanzada) && (
        <>
        {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 border border-red-200">
          <div className="mb-1">{friendlyError(error)}</div>
          <div className="mt-2 flex gap-2">
            {retryRef.current && (
              <button
                onClick={function () { if (retryRef.current) retryRef.current(); }}
                disabled={sending}
                className="text-xs font-medium text-red-700 underline underline-offset-2 hover:text-red-900 disabled:opacity-50"
              >
                {sending ? (dispLang === 'en' ? 'Retrying...' : 'Reintentando...') : (dispLang === 'en' ? 'Retry' : 'Reintentar')}
              </button>
            )}
            {!showManualEditor && (
              <button
                onClick={function () { setShowManualEditor(true); }}
                className="text-xs font-medium text-blue-700 underline underline-offset-2 hover:text-blue-900"
              >
                {dispLang === 'en' ? 'Write my own conclusion' : 'Escribir mi propia conclusion'}
              </button>
            )}
          </div>
        </div>
      )}
      {showManualEditor && !awaitingApproval && (
        <div className="glass-panel p-4 space-y-2">
          <p className="text-sm font-medium text-slate-700">{dispLang === 'en' ? 'Write your conclusion for Phase ' + currentPhase + ' manually:' : 'Escribe tu conclusion para la Fase ' + currentPhase + ' manualmente:'}</p>
          <textarea
            value={manualContent}
            onChange={function (e) { setManualContent(e.target.value); }}
            rows={10}
            placeholder={dispLang === 'en' ? 'Describe your analysis for this phase here...' : 'Describe aqui tu analisis para esta fase...'}
            className="w-full resize-y rounded border border-slate-300 bg-white p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex gap-2">
            <Button onClick={function () { setShowManualEditor(false); setManualContent(''); }} variant="outline" size="sm">
              {dispLang === 'en' ? 'Cancel' : 'Cancelar'}
            </Button>
            <Button onClick={function () { manualApprovePhase(currentPhase, manualContent); }} disabled={sending || !manualContent.trim()} size="sm">
              {sending ? (dispLang === 'en' ? 'Saving...' : 'Guardando...') : (dispLang === 'en' ? 'Save and approve Phase ' + currentPhase : 'Guardar y aprobar Fase ' + String(currentPhase))}
            </Button>
          </div>
        </div>
      )}
      <div className="flex flex-col gap-2">
        {awaitingApproval && editingMessageIndex === null && !showManualEditor && (
          <Button onClick={function () { handleApprove(); }} disabled={sending}>
            {allPhasesDone
              ? (dispLang === locale ? t('approveFinalButton') : UI_FALLBACK[dispLang].approveFinalButton)
              : (dispLang === locale ? t('approveButton', { phase: currentPhase }) : UI_FALLBACK[dispLang].approveButton(currentPhase))}
          </Button>
        )}
        {awaitingApproval && showManualEditor && (
          <div className="glass-panel p-4 space-y-2">
            <p className="text-sm font-medium text-slate-700">{dispLang === 'en' ? 'Write your own conclusion for Phase ' + currentPhase + ':' : 'Escribe tu propia conclusion para la Fase ' + currentPhase + ':'}</p>
            <textarea
              value={manualContent}
              onChange={function (e) { setManualContent(e.target.value); }}
              rows={10}
              placeholder={dispLang === 'en' ? 'Describe your analysis for this phase here...' : 'Describe aqui tu analisis para esta fase...'}
              className="w-full resize-y rounded border border-slate-300 bg-white p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-2">
              <Button onClick={function () { setShowManualEditor(false); setManualContent(''); }} variant="outline" size="sm">
                {dispLang === 'en' ? 'Cancel' : 'Cancelar'}
              </Button>
              <Button onClick={function () { manualApprovePhase(currentPhase, manualContent); }} disabled={sending || !manualContent.trim()} size="sm">
                {sending ? (dispLang === 'en' ? 'Saving...' : 'Guardando...') : (dispLang === 'en' ? 'Save and approve Phase ' + currentPhase : 'Guardar y aprobar Fase ' + String(currentPhase))}
              </Button>
            </div>
          </div>
        )}
        {awaitingApproval && editingMessageIndex !== null && (
          <div className="flex gap-2">
            <Button onClick={handleCancelEdit} disabled={sending} variant="outline" className="flex-1">
              {dispLang === 'en' ? 'Cancel' : 'Cancelar'}
            </Button>
            <Button onClick={function () { handleApprove(editContent); }} disabled={sending} className="flex-[2]">
              {dispLang === 'en' ? 'Save and approve' : 'Guardar y aprobar'}
            </Button>
          </div>
        )}
        {allPhasesDone && !awaitingApproval && (
          <Button onClick={handleCompile} disabled={compiling} variant="outline" className="w-full">
            {compiling ? (dispLang === 'en' ? 'Updating...' : 'Actualizando...') : (dispLang === 'en' ? 'Update compiled plan' : 'Actualizar plan compilado')}
          </Button>
        )}
        <form
          id="babel-entrada"
          onSubmit={function (e) {
            e.preventDefault();
            if (input.trim() === '/compilar' && allPhasesDone) {
              handleCompile();
            } else {
              sendMessage(input);
            }
          }}
          className="flex gap-2 items-end"
        >
          <textarea
            value={input}
            onChange={function (e) { setInput(e.target.value); }}
            onKeyDown={function (e) {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
              }
            }}
            placeholder={dispLang === locale ? t('placeholder') : UI_FALLBACK[dispLang].placeholder}
            disabled={sending || (awaitingApproval && editingMessageIndex === null && !showManualEditor)}
            rows={3}
            className="flex-1 resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 min-h-[80px]"
          />
          <Button type="submit" disabled={sending || (awaitingApproval && editingMessageIndex === null && !showManualEditor) || !input.trim()} className="mb-0 h-10">
            {dispLang === locale ? t('send') : UI_FALLBACK[dispLang].send}
          </Button>
        </form>
      </div>
        </>
      )}
      <PageTour pageId="babel-reflexion" steps={pasosTour} lang={dispLang} />
    </div>
    </React.Fragment>
  );
}

export default BabelPageChat;

// ---------------------------------------------------------------------------
// MarkdownMessage — renderiza el contenido de un mensaje de Babel como
// Markdown (con soporte de tablas GFM) en lugar de texto plano.
// ---------------------------------------------------------------------------
function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="text-sm leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="mb-2 mt-4 text-base font-bold first:mt-0">{children}</h1>,
          h2: ({ children }) => <h2 className="mb-2 mt-4 text-base font-bold first:mt-0">{children}</h2>,
          h3: ({ children }) => <h3 className="mb-1.5 mt-3 text-sm font-semibold first:mt-0">{children}</h3>,
          h4: ({ children }) => <h4 className="mb-1.5 mt-3 text-sm font-semibold first:mt-0">{children}</h4>,
          p: ({ children }) => <p className="my-1.5">{children}</p>,
          ul: ({ children }) => <ul className="my-1.5 list-disc space-y-0.5 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="my-1.5 list-decimal space-y-0.5 pl-5">{children}</ol>,
          li: ({ children }) => <li>{children}</li>,
          hr: () => <hr className="my-3 border-t border-slate-200 dark:border-slate-700" />,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          blockquote: ({ children }) => (
            <blockquote className="my-2 border-l-4 border-slate-300 pl-3 text-slate-600 dark:border-slate-600 dark:text-slate-300">
              {children}
            </blockquote>
          ),
          code: ({ children }) => (
            <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs dark:bg-slate-800">
              {children}
            </code>
          ),
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
              <table className="min-w-full border-collapse text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-slate-50 dark:bg-slate-800/60">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="border-b border-slate-200 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide dark:border-slate-700">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-slate-200 px-3 py-2 align-top dark:border-slate-700">
              {children}
            </td>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/40">{children}</tr>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

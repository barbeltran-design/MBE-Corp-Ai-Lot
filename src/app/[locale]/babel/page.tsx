'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { Timestamp } from 'firebase/firestore';
import { getFirebaseAuth } from '@/lib/firebase';
import {
  getOrCreateBabelSession,
  saveBabelMessages,
  approveBabelPhase,
  compileApprovedPhases,
  resetBabelSession,
  updateBabelPhaseSummary,
} from '@/lib/babel-session';
import { BABEL_IMPLEMENTED_PHASES, babelApprovalMarker } from '@/lib/babel-constants';
import { downloadCompiledPlanPdf, downloadFinancialGoalsExcel, computeFinancialGoals } from '@/lib/deliverables';
import type { FinancialGoalsInput, FinancialGoalsResult } from '@/lib/deliverables';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { BabelPhaseRecord, ChatMessage, SessionDoc } from '@/types/firestore';
// Preguntas de la Fase 0 (una por una)
const PHASE_0_QUESTIONS = {
  es: [
    { key: 'giro', question: '### 1. Giro y nicho especifico\n\nQue vendes exactamente y a quien va dirigido?' },
    { key: 'ubicacion', question: '### 2. Ubicacion operativa\n\nEn que ciudad, estado y pais operara el negocio?' },
    { key: 'madurez', question: '### 3. Madurez actual\n\nEs una idea en papel, un producto o servicio ya validado, o un negocio en marcha buscando escalar?' },
    { key: 'recursos', question: '### 4. Recursos disponibles\n\nCon que recursos materiales, humanos, intelectuales (marca, procesos, patentes) y financieros cuentas actualmente?' },
    { key: 'ambicion', question: '### 5. Nivel de ambicion financiera\n\nBuscas crear un autoempleo sostenible o una estructura escalable para levantar capital de inversionistas?' },
    { key: 'mision_vision', question: '### 6. Proposito Comun, Mision y vision\n\nYa las tienes definidas o prefieres que las disenemos desde cero?' },
    { key: 'utilidad_deseada', question: '### 7. Utilidad mensual deseada\n\nCuanto dinero neto quisieras que sobrara de ganancias mensualmente para vivir? (en tu moneda local)' },
    { key: 'sueldo_founder', question: '### 8. Sueldo del fundador\n\nSi vas a operar el negocio, que sueldo te asignarias para cubrir hasta 3 roles, que seria el mismo que le pagarias a otra persona por hacer cada rol? (Administracion, Comercial, Operacion)' },
    { key: 'gastos_fijos', question: '### 9. Gastos fijos\n\nQue gastos fijos tienes que pagar aunque no vendas (renta, servicios, software)?' },
    { key: 'gastos_variables', question: '### 10. Gastos variables\n\nQue % de tus ingresos pagas de gastos variables paraa entregar tu producto o servicio (materia prima, comisiones, impuestos)?' }
  ],
  en: [
    { key: 'giro', question: '### 1. Business Type and Niche\n\nWhat exactly do you sell and who is it for?' },
    { key: 'ubicacion', question: '### 2. Operational Location\n\nIn which city, state and country will the business operate?' },
    { key: 'madurez', question: '### 3. Current Maturity\n\nIs it an idea on paper, a validated product or service, or an ongoing business seeking to scale?' },
    { key: 'recursos', question: '### 4. Available Resources\n\nWhat material, human, intelectual and financial resources do you currently have?' },
    { key: 'ambicion', question: '### 5. Financial Ambition Level\n\nAre you looking to create sustainable self-employment or a scalable structure to raise capital from investors?' },
    { key: 'mision_vision', question: '### 6. Shared Goal, Mission and Vision\n\nDo you already have them defined or would you prefer us to design them from scratch?' },
    { key: 'utilidad_deseada', question: '### 7. Desired Monthly Profit\n\nHow much net profit would you like to have left over each month to live on? (in your local currency)' },
    { key: 'sueldo_founder', question: '### 8. Founder Salary\n\nIf you are going to run the business, what salary would you assign yourself to cover up to 3 roles, which would be the same as what you would pay another person to perform each role? (Administration, Commercial, Operations)' },
    { key: 'gastos_fijos', question: '### 9. Fixed Costs\n\nWhat fixed costs (rent, services, software) do you pay even if you dont sale anything?' },
    { key: 'gastos_variables', question: '### 10. Variable Costs\n\nWhat percentage of your revenue goes toward variable costs (raw materials, commissions, taxes) to deliver your product or service?' }
  ]
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
    title: 'Babel AI',
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
    title: 'Babel AI',
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
const FASE0_ORDERED_KEYS = ['giro', 'ubicacion', 'madurez', 'recursos', 'ambicion', 'mision_vision', 'utilidad_deseada', 'sueldo_founder', 'gastos_fijos', 'gastos_variables'];
function fase0IntroText(lang: 'es' | 'en'): string {
  return lang === 'en'
    ? 'Hi! I\'m **Babel**, MBE Corp\'s Strategic Business Architect & Sustainability Lead.\n\nTo get started on the right foot, I\'ll ask you **10 key questions**, one at a time. Take your time.\n\n**Note:** Use Enter to add a new line. The message is only sent when you press the "Send" button.\n\n---\n\n'
    : 'Hola! Soy **Babel**, Strategic Business Architect & Sustainability Lead de MBE Corp.\n\nPara iniciar con el pie derecho, te hare **10 preguntas clave** una por una. Responde con calma.\n\n**Nota:** Usa la tecla Enter para bajar de renglon. El mensaje solo se envia cuando presionas el boton "Enviar".\n\n---\n\n';
}
function fase0LabelsFor(lang: 'es' | 'en'): Record<string, string> {
  return lang === 'en'
    ? { giro: 'Business Type', ubicacion: 'Location', madurez: 'Maturity', recursos: 'Resources', ambicion: 'Ambition', mision_vision: 'Mission & Vision', utilidad_deseada: 'Desired Monthly Profit', sueldo_founder: 'Founder Salary', gastos_fijos: 'Fixed Costs', gastos_variables: 'Variable Costs' }
    : { giro: 'Giro y nicho', ubicacion: 'Ubicación', madurez: 'Madurez', recursos: 'Recursos', ambicion: 'Ambición', mision_vision: 'Misión y Visión', utilidad_deseada: 'Utilidad mensual deseada', sueldo_founder: 'Sueldo del fundador', gastos_fijos: 'Gastos fijos', gastos_variables: 'Gastos variables' };
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
function toAmountPct(value: number, mode: '$' | '%', unitPrice: number): number {
  if (mode === '%') return value / 100;
  return unitPrice > 0 ? value / unitPrice : 0;
}
export default function BabelPage() {
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
  // Cache de traducciones (por IA) del contenido REAL de los mensajes de
  // Babel, para cuando dispLang no coincide con el idioma en que se generaron.
  // Clave: indice del mensaje + '::' + idioma destino.
  const [translatedCache, setTranslatedCache] = React.useState<Record<string, string>>({});
  const [translatingSet, setTranslatingSet] = React.useState<Set<number>>(new Set());
  const [finActive, setFinActive] = React.useState(false);
  const [finStage, setFinStage] = React.useState(1);
  const [finReviewing, setFinReviewing] = React.useState(false);
  const [finSending, setFinSending] = React.useState(false);
  const [finError, setFinError] = React.useState<string | null>(null);
  const [finUnitPrice, setFinUnitPrice] = React.useState(0);
  const [finMaterialsValue, setFinMaterialsValue] = React.useState(0);
  const [finMaterialsMode, setFinMaterialsMode] = React.useState<'$' | '%'>('$');
  const [finLaborValue, setFinLaborValue] = React.useState(0);
  const [finLaborMode, setFinLaborMode] = React.useState<'$' | '%'>('$');
  const [finOtherValue, setFinOtherValue] = React.useState(0);
  const [finOtherMode, setFinOtherMode] = React.useState<'$' | '%'>('$');
  const [finFixedTotalInput, setFinFixedTotalInput] = React.useState(0);
  const [finDesiredProfit, setFinDesiredProfit] = React.useState(0);
  const [finFixedItems, setFinFixedItems] = React.useState<{ name: string; amount: number }[]>([]);
  const [finVarItems, setFinVarItems] = React.useState<{ name: string; value: number; mode: '$' | '%' }[]>([]);
  const [finChannels, setFinChannels] = React.useState<{ name: string; pct: number }[]>([]);
  const [finMarketingPct, setFinMarketingPct] = React.useState(0);
  const [finDone, setFinDone] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement>(null);
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
  React.useEffect(() => {
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
      setSession(prev => prev ? { ...prev, messages: [questionMsg] } : prev);
    }
  }, [session, currentQuestionIndex, isPhase0Complete, questions, dispLang]);
  const currentPhase = session?.currentPhase ?? 0;
  const allPhasesDone = currentPhase >= BABEL_IMPLEMENTED_PHASES;
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
  React.useEffect(() => {
    if (!session || dispLang === locale) return;
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
      1: '### 1. Propuesta de Valor\n\n**Trabajos funcionales:** \n\n**Trabajos emocionales:** \n\n**Trabajos sociales:** \n\n---\n\n### 2. Modelo de Negocio\n\n**Segmento de clientes:** \n\n**Propuesta de valor:** \n\n**Canales:** \n\n**Fuentes de ingreso:** \n\n---\n\n### 3. Proposito (Golden Circle)\n\n**Why (Proposito):** \n\n**How (Diferenciacion):** \n\n**What (Que vendes):** \n\n---\n\n### 4. Segmentacion\n\n**Arquetipo 1:** \n\n**Oceano Azul:** \n\n**Impacto social:** \n\n---\n\n### 5. ODS y Fondos\n\n**ODS vinculados:** \n\n**Fondos sugeridos:**',
      2: '### 1. Analisis PESTEL\n\n**Politico:** \n\n**Economico:** \n\n**Social:** \n\n**Tecnologico:** \n\n**Ecologico:** \n\n**Legal:** \n\n---\n\n### 2. Fuerzas del Mercado\n\n**Competidores directos:** \n\n**Competidores indirectos:** \n\n**Nuevos entrantes:** \n\n---\n\n### 3. Tendencias Sectoriales\n\n\n---\n\n### 4. Prospectiva a 5 Anos\n\n**Escenario optimista:** \n\n**Escenario conservador:**',
      3: '### 1. Capacidades Clave\n\n**Capacidades basicas:** \n\n**Capacidades diferenciadoras:** \n\n---\n\n### 2. Plan Operativo\n\n**Infraestructura:** \n\n**Cadena de suministro:** \n\n**Personal requerido:** \n\n---\n\n### 3. Estrategia Comercial\n\n**Marketing mix:** \n\n**Embudo de ventas:** \n\n**Customer Journey:**',
      4: '### 1. Costos de Arranque y OpEx\n\n**Costos de arranque:** \n\n**Gastos operativos mensuales:** \n\n---\n\n### 2. Estrategia de Precios\n\n\n---\n\n### 3. Flujo de Caja Ano 1\n\n**Mes 1:** \n\n**Mes 2-12:** \n\n---\n\n### 4. Estado de Resultados\n\n**Ano 1:** \n\n**Ano 3:** \n\n**Ano 5:**',
      5: '### 1. Balanced Scorecard + OKRs\n\n**Finanzas:** \n\n**Clientes:** \n\n**Procesos:** \n\n**Aprendizaje:** \n\n---\n\n### 2. Matriz de Impacto\n\n**Colaboradores:** \n\n**Sociedad:** \n\n**Medio ambiente:** \n\n---\n\n### 3. FODA Cruzado\n\n**Fortalezas:** \n\n**Oportunidades:** \n\n**Debilidades:** \n\n**Amenazas:** \n\n---\n\n### 4. Marco Agil\n\n\n---\n\n### 5. Elevator Pitch\n\n',
    };
    return templates[phase] ?? '### Escribe aqui tu analisis para esta fase...';
  };
  function friendlyError(raw: string): string {
    if (raw.includes('image.png')) {
      return 'Error de formato al contactar la IA. Revisa que las API keys en Vercel sean validas (Groq, OpenRouter, Gemini). Detalle: ' + raw.slice(0, 300);
    }
    return raw;
  }
  function renderLangToggle() {
    return (
      <div className="flex items-center gap-1 text-xs text-slate-500">
        <span>{dispLang === 'en' ? 'Language:' : 'Idioma:'}</span>
        <button
          type="button"
          onClick={function () { setDispLang('es'); }}
          className={'rounded px-2 py-0.5 font-medium ' + (dispLang === 'es' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}
        >
          ES
        </button>
        <button
          type="button"
          onClick={function () { setDispLang('en'); }}
          className={'rounded px-2 py-0.5 font-medium ' + (dispLang === 'en' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}
        >
          EN
        </button>
      </div>
    );
  }
  React.useEffect(() => {
    if (session && (session.currentPhase ?? 0) > 0) {
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
      setSession(function (prev) { return prev ? { ...prev, messages: finalMessages } : { ...refreshed, messages: finalMessages }; });
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
      setSession(function (prev) { return prev ? { ...prev, messages: finalMessages } : { ...refreshed, messages: finalMessages }; });
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
          downloadCompiledPlanPdf({ sessionTopic: session.topic, compiledText: compiled, language: locale });
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
  function handleStartFinancialGoals() {
    setFinActive(true);
    setFinStage(1);
    setFinReviewing(false);
    setFinSending(false);
    setFinError(null);
    setFinUnitPrice(0);
    setFinMaterialsValue(0);
    setFinMaterialsMode('$');
    setFinLaborValue(0);
    setFinLaborMode('$');
    setFinOtherValue(0);
    setFinOtherMode('$');
    setFinFixedTotalInput(0);
    setFinDesiredProfit(0);
    setFinFixedItems([]);
    setFinVarItems([]);
    setFinChannels([]);
    setFinMarketingPct(0);
    setFinDone(false);
  }
  function handleCloseFinancialGoals() {
    setFinActive(false);
    setFinStage(1);
    setFinReviewing(false);
    setFinSending(false);
    setFinError(null);
    setFinUnitPrice(0);
    setFinMaterialsValue(0);
    setFinMaterialsMode('$');
    setFinLaborValue(0);
    setFinLaborMode('$');
    setFinOtherValue(0);
    setFinOtherMode('$');
    setFinFixedTotalInput(0);
    setFinDesiredProfit(0);
    setFinFixedItems([]);
    setFinVarItems([]);
    setFinChannels([]);
    setFinMarketingPct(0);
    setFinDone(false);
  }
  function addFixedItem() {
    setFinFixedItems(function (prev) { return [...prev, { name: '', amount: 0 }]; });
  }
  function updateFixedItem(index: number, patch: Partial<{ name: string; amount: number }>) {
    setFinFixedItems(function (prev) { return prev.map(function (item, i) { return i === index ? { ...item, ...patch } : item; }); });
  }
  function removeFixedItem(index: number) {
    setFinFixedItems(function (prev) { return prev.filter(function (_, i) { return i !== index; }); });
  }
  function addVarItem() {
    setFinVarItems(function (prev) { return [...prev, { name: '', value: 0, mode: '$' as '$' | '%' }]; });
  }
  function updateVarItem(index: number, patch: Partial<{ name: string; value: number; mode: '$' | '%' }>) {
    setFinVarItems(function (prev) { return prev.map(function (item, i) { return i === index ? { ...item, ...patch } : item; }); });
  }
  function removeVarItem(index: number) {
    setFinVarItems(function (prev) { return prev.filter(function (_, i) { return i !== index; }); });
  }
  function addChannel() {
    setFinChannels(function (prev) { return [...prev, { name: '', pct: 0 }]; });
  }
  function updateChannel(index: number, patch: Partial<{ name: string; pct: number }>) {
    setFinChannels(function (prev) { return prev.map(function (item, i) { return i === index ? { ...item, ...patch } : item; }); });
  }
  function removeChannel(index: number) {
    setFinChannels(function (prev) { return prev.filter(function (_, i) { return i !== index; }); });
  }
  function handleFinNext() {
    setFinError(null);
    if (finStage === 1) {
      if (finUnitPrice <= 0) {
        setFinError(dispLang === 'en' ? 'Enter a sale price greater than zero.' : 'Ingresa un precio de venta mayor a cero.');
        return;
      }
      const baseVarPct =
        toAmountPct(finMaterialsValue, finMaterialsMode, finUnitPrice) +
        toAmountPct(finLaborValue, finLaborMode, finUnitPrice) +
        toAmountPct(finOtherValue, finOtherMode, finUnitPrice);
      if (baseVarPct >= 1) {
        setFinError(
          dispLang === 'en'
            ? 'Your variable costs already add up to 100% or more of your sale price. Adjust the numbers before continuing.'
            : 'Tus costos variables ya suman 100% o más de tu precio de venta. Ajusta los montos antes de continuar.'
        );
        return;
      }
      setFinStage(2);
      return;
    }
    if (finStage === 2) {
      const baseVarPct =
        toAmountPct(finMaterialsValue, finMaterialsMode, finUnitPrice) +
        toAmountPct(finLaborValue, finLaborMode, finUnitPrice) +
        toAmountPct(finOtherValue, finOtherMode, finUnitPrice);
      const extraVarPct = finVarItems.reduce(function (s, v) { return s + toAmountPct(v.value, v.mode, finUnitPrice); }, 0);
      if (baseVarPct + extraVarPct >= 1) {
        setFinError(
          dispLang === 'en'
            ? 'Adding your extra variable costs pushes the total to 100% or more of your price. Adjust the numbers before continuing.'
            : 'Al sumar tus costos variables adicionales, el total llega a 100% o más de tu precio. Ajusta los montos antes de continuar.'
        );
        return;
      }
      setFinStage(3);
      return;
    }
    if (finStage === 3) {
      if (finChannels.length === 0) {
        setFinError(
          dispLang === 'en'
            ? 'Add at least one revenue channel before continuing.'
            : 'Agrega al menos un canal de ingreso antes de continuar.'
        );
        return;
      }
      const sum = finChannels.reduce(function (s, c) { return s + c.pct; }, 0);
      if (sum <= 0) {
        setFinError(
          dispLang === 'en'
            ? 'Enter a percentage greater than zero for at least one channel.'
            : 'Ingresa un porcentaje mayor a cero en al menos un canal.'
        );
        return;
      }
      setFinStage(4);
      return;
    }
    if (finStage === 4) {
      setFinReviewing(true);
    }
  }
  function handleFinBack() {
    setFinError(null);
    if (finReviewing) {
      setFinReviewing(false);
      return;
    }
    if (finStage > 1) {
      setFinStage(finStage - 1);
    }
  }
  function handleFinGenerate() {
    setFinSending(true);
    setFinError(null);
    try {
      const materialsPct = toAmountPct(finMaterialsValue, finMaterialsMode, finUnitPrice);
      const laborPct = toAmountPct(finLaborValue, finLaborMode, finUnitPrice);
      const otherVarPct = toAmountPct(finOtherValue, finOtherMode, finUnitPrice);
      const varItemsForExcel = finVarItems.map(function (v) {
        return { name: v.name, pct: toAmountPct(v.value, v.mode, finUnitPrice) };
      });
      const channelPctSum = finChannels.reduce(function (s, c) { return s + c.pct; }, 0);
      const normalizedChannels =
        channelPctSum > 0
          ? finChannels.map(function (c) { return { name: c.name, pct: c.pct / channelPctSum }; })
          : finChannels.map(function (c) { return { name: c.name, pct: 0 }; });
      const goalsInput: FinancialGoalsInput = {
        language: dispLang,
        unitPrice: finUnitPrice,
        materialsPct: materialsPct,
        laborPct: laborPct,
        otherVarPct: otherVarPct,
        fixedItems: finFixedItems,
        fixedTotalFallback: finFixedTotalInput,
        varItems: varItemsForExcel,
        desiredProfit: finDesiredProfit,
        channels: normalizedChannels,
        marketingPct: finMarketingPct / 100,
      };
      try {
        const resultForSave = computeFinancialGoals(goalsInput);
        window.localStorage.setItem(
          'babel_financial_goals_v1',
          JSON.stringify({ input: goalsInput, result: resultForSave, savedAt: new Date().toISOString() })
        );
      } catch (saveErr) {
        console.error(saveErr);
      }
      downloadFinancialGoalsExcel(goalsInput);
      setFinDone(true);
    } catch (err) {
      setFinError(err instanceof Error ? err.message : (dispLang === 'en' ? 'Error generating file' : 'Error al generar el archivo'));
    } finally {
      setFinSending(false);
    }
  }
  async function handleLogout() {
    const auth = getFirebaseAuth();
    await signOut(auth);
    router.push('/' + locale);
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
  if (!session) {
    return <div className="flex min-h-screen items-center justify-center text-slate-500">{dispLang === locale ? t('loading') : UI_FALLBACK[dispLang].loading}</div>;
  }
  const isPhase0Active = currentPhase === 0 && currentQuestionIndex < questions.length && !isPhase0Complete;
  if (isPhase0Active) {
    return (
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 p-4 sm:p-6">
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{dispLang === locale ? t('title') : UI_FALLBACK[dispLang].title}</h1>
            <p className="text-sm text-slate-500">{dispLang === 'en' ? 'Phase 0: Initial Calibration' : 'Fase 0: Calibración Inicial'}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            {renderLangToggle()}
            <div className="flex gap-2">
              <Button onClick={handleReset} disabled={sending} variant="outline" size="sm">{dispLang === 'en' ? 'Start over' : 'Empezar de nuevo'}</Button>
              <Button onClick={handleLogout} variant="outline" size="sm">{dispLang === 'en' ? 'Log out' : 'Cerrar sesión'}</Button>
            </div>
          </div>
        </div>
        {currentQuestionIndex > 0 && (
          <Card className="flex-1 space-y-3 overflow-y-auto p-4 max-h-[40vh]">
            {Array.from({ length: currentQuestionIndex }).map(function (_unused, k) {
              const qText = (k === 0 ? fase0IntroText(dispLang) : '') + questions[k].question;
              const answerText = phase0Answers[questions[k].key] ?? '';
              return (
                <React.Fragment key={k}>
                  <div className="max-w-[85%] rounded-xl bg-slate-100 px-3.5 py-2 text-sm text-slate-900 whitespace-pre-wrap">
                    {qText}
                  </div>
                  <div className="ml-auto max-w-[85%] rounded-xl bg-slate-900 px-3.5 py-2 text-sm text-white whitespace-pre-wrap">
                    {answerText}
                  </div>
                </React.Fragment>
              );
            })}
          </Card>
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
          <Card className="p-4 space-y-2">
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
          </Card>
        )}
        <Card className="p-6">
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
        </Card>
      </div>
    );
  }
  const finMaterialsPctLive = toAmountPct(finMaterialsValue, finMaterialsMode, finUnitPrice);
  const finLaborPctLive = toAmountPct(finLaborValue, finLaborMode, finUnitPrice);
  const finOtherPctLive = toAmountPct(finOtherValue, finOtherMode, finUnitPrice);
  const finBaseVarPct = finMaterialsPctLive + finLaborPctLive + finOtherPctLive;
  const finExtraVarPct = finVarItems.reduce(function (s, v) { return s + toAmountPct(v.value, v.mode, finUnitPrice); }, 0);
  const finTotalVarPct = finBaseVarPct + finExtraVarPct;
  const finStage1Invalid = finBaseVarPct >= 1;
  const finStage1Denom = 1 - finBaseVarPct;
  const finStage1BreakEven = finStage1Invalid ? null : finFixedTotalInput / finStage1Denom;
  const finStage1Target = finStage1Invalid ? null : (finFixedTotalInput + finDesiredProfit) / finStage1Denom;
  const finItemizedFixedTotal =
    finFixedItems.length > 0
      ? finFixedItems.reduce(function (s, f) { return s + f.amount; }, 0)
      : finFixedTotalInput;
  const finInvalid = finTotalVarPct >= 1;
  const finDenom = 1 - finTotalVarPct;
  const finBreakEven = finInvalid ? null : finItemizedFixedTotal / finDenom;
  const finTarget = finInvalid ? null : (finItemizedFixedTotal + finDesiredProfit) / finDenom;
  const finChannelPctSum = finChannels.reduce(function (s, c) { return s + c.pct; }, 0);
  const finChannelsNormalized =
    finChannelPctSum > 0
      ? finChannels.map(function (c) { return { name: c.name, pct: c.pct / finChannelPctSum }; })
      : finChannels.map(function (c) { return { name: c.name, pct: 0 }; });
  const finResultLive: FinancialGoalsResult | null =
    !finInvalid && finChannels.length > 0
      ? computeFinancialGoals({
          language: dispLang,
          unitPrice: finUnitPrice,
          materialsPct: finMaterialsPctLive,
          laborPct: finLaborPctLive,
          otherVarPct: finOtherPctLive,
          fixedItems: finFixedItems,
          fixedTotalFallback: finFixedTotalInput,
          varItems: finVarItems.map(function (v) { return { name: v.name, pct: toAmountPct(v.value, v.mode, finUnitPrice) }; }),
          desiredProfit: finDesiredProfit,
          channels: finChannelsNormalized,
          marketingPct: finMarketingPct / 100,
        })
      : null;
  return (
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col gap-4 p-4 sm:p-6">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{dispLang === locale ? t('title') : UI_FALLBACK[dispLang].title}</h1>
          <p className="text-sm text-slate-500">{(session as any).phaseData?.topic || (dispLang === locale ? t('subtitle') : UI_FALLBACK[dispLang].subtitle)}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {renderLangToggle()}
          <div className="flex gap-2">
            <Button onClick={function () { router.push('/' + locale + '/babel/organigrama'); }} variant="outline" size="sm">
              {dispLang === 'en' ? 'Org Chart & Roles' : 'Organigrama y Roles'}
            </Button>
            <Button onClick={function () { router.push('/' + locale + '/babel/plan-accion'); }} variant="outline" size="sm">
              {dispLang === 'en' ? 'Action Plan' : 'Plan de Acción'}
            </Button>
            <Button onClick={handleReset} disabled={sending} variant="outline" size="sm">{dispLang === 'en' ? 'Start over' : 'Empezar de nuevo'}</Button>
            <Button onClick={handleLogout} variant="outline" size="sm">{dispLang === 'en' ? 'Log out' : 'Cerrar sesión'}</Button>
          </div>
        </div>
      </div>
      <Card className="flex-1 space-y-3 overflow-y-auto p-4 min-h-[60vh]">
        {session.messages.map(function (m, i) {
          const isFase0SummaryPair = currentPhase === 0 && i <= 1 && Object.keys(phase0Answers).length > 0;
          const translationKey = i + '::' + dispLang;
          const isTranslatable = m.role === 'assistant' && !isFase0SummaryPair && dispLang !== locale;
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
                <div className={'whitespace-pre-wrap ' + (isLong && !isExpanded ? 'max-h-32 overflow-y-auto' : '')}>
                  {displayContent}
                </div>
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
      </Card>
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
        <Card className="p-4 space-y-2">
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
        </Card>
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
          <Card className="p-4 space-y-2">
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
          </Card>
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
        {allPhasesDone && !awaitingApproval && !finActive && (
          <Button onClick={handleStartFinancialGoals} variant="outline" className="w-full">
            {dispLang === 'en' ? 'Define financial goals (break-even + projection)' : 'Definir objetivos financieros (punto de equilibrio + proyección)'}
          </Button>
        )}
        {finActive && (
          <Card className="p-4 space-y-3">
            {finDone ? (
              <div className="space-y-2 text-sm text-slate-800">
                <p className="font-semibold">
                  {dispLang === 'en' ? 'Your financial goals file was downloaded.' : 'Tu archivo de metas propuestas se descargó.'}
                </p>
                <Button onClick={handleCloseFinancialGoals} variant="outline" size="sm">
                  {dispLang === 'en' ? 'Close' : 'Cerrar'}
                </Button>
              </div>
            ) : (
              <>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: String((Math.min(finStage, 4) / 4) * 100) + '%' }} />
                </div>
                <p className="text-xs text-slate-500">
                  {dispLang === 'en' ? 'Stage' : 'Etapa'} {Math.min(finStage, 4)} {dispLang === 'en' ? 'of 4' : 'de 4'}
                </p>
                {finError && (
                  <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 border border-red-200">
                    {finError}
                  </div>
                )}
                {!finReviewing && finStage === 1 && (
                  <div className="space-y-3 text-sm text-slate-800">
                    <p className="font-semibold">{dispLang === 'en' ? 'Stage 1: Your product or service' : 'Etapa 1: Tu producto o servicio'}</p>
                    <label className="block space-y-1">
                      <span className="text-xs text-slate-600">{dispLang === 'en' ? 'Sale price per unit' : 'Precio de venta por unidad'}</span>
                      <input
                        type="number"
                        value={finUnitPrice || ''}
                        onChange={function (e) { setFinUnitPrice(Number(e.target.value)); }}
                        placeholder="500"
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </label>
                    <div className="space-y-1">
                      <span className="text-xs text-slate-600">{dispLang === 'en' ? 'Materials cost' : 'Costo de materiales'}</span>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={finMaterialsValue || ''}
                          onChange={function (e) { setFinMaterialsValue(Number(e.target.value)); }}
                          className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <select
                          value={finMaterialsMode}
                          onChange={function (e) { setFinMaterialsMode(e.target.value as '$' | '%'); }}
                          className="rounded-md border border-slate-300 bg-white px-2 py-2 text-sm"
                        >
                          <option value="$">$</option>
                          <option value="%">%</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-slate-600">{dispLang === 'en' ? 'Labor cost' : 'Costo de personal'}</span>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={finLaborValue || ''}
                          onChange={function (e) { setFinLaborValue(Number(e.target.value)); }}
                          className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <select
                          value={finLaborMode}
                          onChange={function (e) { setFinLaborMode(e.target.value as '$' | '%'); }}
                          className="rounded-md border border-slate-300 bg-white px-2 py-2 text-sm"
                        >
                          <option value="$">$</option>
                          <option value="%">%</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-slate-600">{dispLang === 'en' ? 'Other variable costs' : 'Otros costos variables'}</span>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={finOtherValue || ''}
                          onChange={function (e) { setFinOtherValue(Number(e.target.value)); }}
                          className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <select
                          value={finOtherMode}
                          onChange={function (e) { setFinOtherMode(e.target.value as '$' | '%'); }}
                          className="rounded-md border border-slate-300 bg-white px-2 py-2 text-sm"
                        >
                          <option value="$">$</option>
                          <option value="%">%</option>
                        </select>
                      </div>
                    </div>
                    <label className="block space-y-1">
                      <span className="text-xs text-slate-600">{dispLang === 'en' ? 'Total monthly fixed costs' : 'Gastos fijos mensuales totales'}</span>
                      <input
                        type="number"
                        value={finFixedTotalInput || ''}
                        onChange={function (e) { setFinFixedTotalInput(Number(e.target.value)); }}
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-xs text-slate-600">{dispLang === 'en' ? 'Desired monthly profit' : 'Utilidad mensual deseada'}</span>
                      <input
                        type="number"
                        value={finDesiredProfit || ''}
                        onChange={function (e) { setFinDesiredProfit(Number(e.target.value)); }}
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </label>
                    <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-1">
                      <p>{dispLang === 'en' ? '% Variable costs' : '% Costos variables'}: {(finBaseVarPct * 100).toFixed(1)}%</p>
                      {finStage1Invalid ? (
                        <p className="text-red-600 font-medium">
                          {dispLang === 'en'
                            ? 'Your variable costs already reach 100% or more of your price. Fix the numbers above before continuing.'
                            : 'Tus costos variables ya llegan a 100% o más de tu precio. Corrige los montos antes de continuar.'}
                        </p>
                      ) : (
                        <>
                          <p>{dispLang === 'en' ? 'Break-even point' : 'Punto de equilibrio'}: {finStage1BreakEven !== null ? finStage1BreakEven.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}</p>
                          <p>{dispLang === 'en' ? 'Revenue needed for your profit goal' : 'Ingreso necesario para tu meta de utilidad'}: {finStage1Target !== null ? finStage1Target.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}</p>
                        </>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleFinNext} size="sm">{dispLang === 'en' ? 'Continue' : 'Continuar'}</Button>
                    </div>
                  </div>
                )}
                {!finReviewing && finStage === 2 && (
                  <div className="space-y-3 text-sm text-slate-800">
                    <p className="font-semibold">{dispLang === 'en' ? 'Stage 2: Break down your costs (optional)' : 'Etapa 2: Desglosa tus gastos (opcional)'}</p>
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-slate-600">{dispLang === 'en' ? 'Fixed costs' : 'Gastos fijos'}</p>
                      {finFixedItems.map(function (item, i) {
                        return (
                          <div key={i} className="flex gap-2 items-center">
                            <input
                              type="text"
                              value={item.name}
                              onChange={function (e) { updateFixedItem(i, { name: e.target.value }); }}
                              placeholder={dispLang === 'en' ? 'Name (e.g. Rent)' : 'Nombre (ej. Renta)'}
                              className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <input
                              type="number"
                              value={item.amount || ''}
                              onChange={function (e) { updateFixedItem(i, { amount: Number(e.target.value) }); }}
                              placeholder="$"
                              className="w-28 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <button type="button" onClick={function () { removeFixedItem(i); }} className="text-red-500 hover:text-red-700 text-sm px-2">×</button>
                          </div>
                        );
                      })}
                      <button type="button" onClick={addFixedItem} className="text-xs font-medium text-blue-600 hover:text-blue-800 underline underline-offset-2">
                        {dispLang === 'en' ? '+ Add fixed cost' : '+ Agregar gasto fijo'}
                      </button>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-slate-600">{dispLang === 'en' ? 'Extra variable costs (besides materials, labor, other)' : 'Costos variables adicionales (además de materiales, personal, otros)'}</p>
                      {finVarItems.map(function (item, i) {
                        return (
                          <div key={i} className="flex gap-2 items-center">
                            <input
                              type="text"
                              value={item.name}
                              onChange={function (e) { updateVarItem(i, { name: e.target.value }); }}
                              placeholder={dispLang === 'en' ? 'Name (e.g. Commission)' : 'Nombre (ej. Comisión)'}
                              className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <input
                              type="number"
                              value={item.value || ''}
                              onChange={function (e) { updateVarItem(i, { value: Number(e.target.value) }); }}
                              className="w-24 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <select
                              value={item.mode}
                              onChange={function (e) { updateVarItem(i, { mode: e.target.value as '$' | '%' }); }}
                              className="rounded-md border border-slate-300 bg-white px-2 py-2 text-sm"
                            >
                              <option value="$">$</option>
                              <option value="%">%</option>
                            </select>
                            <button type="button" onClick={function () { removeVarItem(i); }} className="text-red-500 hover:text-red-700 text-sm px-2">×</button>
                          </div>
                        );
                      })}
                      <button type="button" onClick={addVarItem} className="text-xs font-medium text-blue-600 hover:text-blue-800 underline underline-offset-2">
                        {dispLang === 'en' ? '+ Add variable cost' : '+ Agregar costo variable'}
                      </button>
                    </div>
                    <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-1">
                      <p>{dispLang === 'en' ? 'Total fixed costs' : 'Total gastos fijos'}: {finItemizedFixedTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                      <p>{dispLang === 'en' ? '% Variable costs' : '% Costos variables'}: {(finTotalVarPct * 100).toFixed(1)}%</p>
                      {finInvalid ? (
                        <p className="text-red-600 font-medium">
                          {dispLang === 'en'
                            ? 'Adding these extra costs pushes your variable costs to 100% or more of your price. Fix the numbers before continuing.'
                            : 'Al sumar estos costos, tus costos variables llegan a 100% o más de tu precio. Corrige los montos antes de continuar.'}
                        </p>
                      ) : (
                        <>
                          <p>{dispLang === 'en' ? 'Break-even point' : 'Punto de equilibrio'}: {finBreakEven !== null ? finBreakEven.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}</p>
                          <p>{dispLang === 'en' ? 'Revenue needed for your profit goal' : 'Ingreso necesario para tu meta de utilidad'}: {finTarget !== null ? finTarget.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}</p>
                        </>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleFinBack} variant="outline" size="sm">{dispLang === 'en' ? 'Back' : 'Atrás'}</Button>
                      <Button onClick={handleFinNext} size="sm">{dispLang === 'en' ? 'Continue' : 'Continuar'}</Button>
                    </div>
                  </div>
                )}
                {!finReviewing && finStage === 3 && (
                  <div className="space-y-3 text-sm text-slate-800">
                    <p className="font-semibold">{dispLang === 'en' ? 'Stage 3: Your revenue channels' : 'Etapa 3: Tus canales de ingreso'}</p>
                    {finChannels.map(function (c, i) {
                      return (
                        <div key={i} className="flex gap-2 items-center">
                          <input
                            type="text"
                            value={c.name}
                            onChange={function (e) { updateChannel(i, { name: e.target.value }); }}
                            placeholder={dispLang === 'en' ? 'Name (e.g. Online sales)' : 'Nombre (ej. Ventas en línea)'}
                            className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <input
                            type="number"
                            value={c.pct || ''}
                            onChange={function (e) { updateChannel(i, { pct: Number(e.target.value) }); }}
                            placeholder="%"
                            className="w-20 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <button type="button" onClick={function () { removeChannel(i); }} className="text-red-500 hover:text-red-700 text-sm px-2">×</button>
                        </div>
                      );
                    })}
                    <button type="button" onClick={addChannel} className="text-xs font-medium text-blue-600 hover:text-blue-800 underline underline-offset-2">
                      {dispLang === 'en' ? '+ Add channel' : '+ Agregar canal'}
                    </button>
                    {finChannels.length > 0 && (
                      <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-1">
                        {finChannelsNormalized.map(function (c, i) {
                          return <p key={i}>{c.name || (dispLang === 'en' ? '(unnamed)' : '(sin nombre)')}: {(c.pct * 100).toFixed(1)}%</p>;
                        })}
                        {Math.abs(finChannelPctSum - 100) > 2 && (
                          <p className="text-xs text-slate-500">
                            {dispLang === 'en'
                              ? "Your percentages didn't add up to 100%, so we'll adjust them proportionally."
                              : 'Tus porcentajes no suman 100%, los ajustaremos proporcionalmente.'}
                          </p>
                        )}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button onClick={handleFinBack} variant="outline" size="sm">{dispLang === 'en' ? 'Back' : 'Atrás'}</Button>
                      <Button onClick={handleFinNext} size="sm">{dispLang === 'en' ? 'Continue' : 'Continuar'}</Button>
                    </div>
                  </div>
                )}
                {!finReviewing && finStage === 4 && (
                  <div className="space-y-3 text-sm text-slate-800">
                    <p className="font-semibold">{dispLang === 'en' ? 'Stage 4: Marketing investment' : 'Etapa 4: Inversión en mercadotecnia'}</p>
                    <label className="block space-y-1">
                      <span className="text-xs text-slate-600">{dispLang === 'en' ? '% of revenue invested in marketing' : '% de ingresos invertido en mercadotecnia'}</span>
                      <input
                        type="number"
                        value={finMarketingPct || ''}
                        onChange={function (e) { setFinMarketingPct(Number(e.target.value)); }}
                        placeholder="10"
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </label>
                    {finResultLive && (
                      <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-1">
                        <p>{dispLang === 'en' ? 'Growth you can expect with that investment' : 'Crecimiento esperado con esa inversión'}: {(finResultLive.expectedGrowthRate * 100).toFixed(1)}% {dispLang === 'en' ? 'monthly' : 'mensual'}</p>
                        <p>{dispLang === 'en' ? 'Growth needed to reach your goal in 12 months' : 'Crecimiento necesario para llegar a tu meta en 12 meses'}: {(finResultLive.requiredGrowthRate * 100).toFixed(1)}% {dispLang === 'en' ? 'monthly' : 'mensual'}</p>
                        {finResultLive.isSufficient ? (
                          <p className="text-green-700 font-medium">
                            {dispLang === 'en' ? 'Your planned investment is enough to reach your goal.' : 'Tu inversión planeada es suficiente para llegar a tu meta.'}
                          </p>
                        ) : (
                          <p className="text-amber-700 font-medium">
                            {finResultLive.recommendedMarketingPct !== null
                              ? (dispLang === 'en'
                                  ? 'That investment is not enough. We recommend investing at least ' + (finResultLive.recommendedMarketingPct * 100).toFixed(0) + '% of your revenue (about ' + (finResultLive.recommendedMarketingAmount ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 }) + ' at the start).'
                                  : 'Con esa inversión no alcanzas tu meta. Te recomendamos invertir al menos ' + (finResultLive.recommendedMarketingPct * 100).toFixed(0) + '% de tus ingresos (aproximadamente ' + (finResultLive.recommendedMarketingAmount ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 }) + ' al inicio).')
                              : (dispLang === 'en'
                                  ? 'Even a high marketing investment would not reach this goal in 12 months. Consider a longer timeline or a lower profit goal.'
                                  : 'Ni siquiera con una inversión alta se alcanza esta meta en 12 meses. Considera un plazo más largo o una meta de utilidad menor.')}
                          </p>
                        )}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button onClick={handleFinBack} variant="outline" size="sm">{dispLang === 'en' ? 'Back' : 'Atrás'}</Button>
                      <Button onClick={handleFinNext} size="sm">{dispLang === 'en' ? 'Continue' : 'Continuar'}</Button>
                    </div>
                  </div>
                )}
                {finReviewing && (
                  <div className="space-y-2 text-sm text-slate-800">
                    <p className="font-semibold">{dispLang === 'en' ? 'Before you download...' : 'Antes de descargar...'}</p>
                    <p>
                      {dispLang === 'en'
                        ? 'Take a look back at what you answered in Phase 0 (your business type, niche, and offer) to confirm these goals still make sense for your business. You can still go back and edit any field.'
                        : 'Revisa lo que respondiste en la Fase 0 (tu giro, nicho y oferta) para confirmar que estas metas sigan alineadas con tu negocio. Todavía puedes regresar y editar cualquier campo.'}
                    </p>
                    <div className="flex gap-2">
                      <Button onClick={handleFinBack} variant="outline" size="sm">{dispLang === 'en' ? 'Back' : 'Atrás'}</Button>
                      <Button onClick={handleFinGenerate} disabled={finSending} size="sm">
                        {finSending ? (dispLang === 'en' ? 'Generating...' : 'Generando...') : (dispLang === 'en' ? 'Generate file' : 'Generar archivo')}
                      </Button>
                    </div>
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleCloseFinancialGoals}
                  className="text-xs font-medium text-slate-500 underline underline-offset-2 hover:text-slate-700"
                >
                  {dispLang === 'en' ? 'Cancel' : 'Cancelar'}
                </button>
              </>
            )}
          </Card>
        )}
        <form
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
    </div>
  );
}

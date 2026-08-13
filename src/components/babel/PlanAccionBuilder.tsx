'use client';
import React from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';
import { getLatestAssessmentAnswers } from '@/lib/assessment';
import { getMaturityDimensions } from '@/lib/maturity-dimensions';
import { computeResults, type AssessmentResult } from '@/lib/maturity-scoring';
import { getBabelSessionIfExists } from '@/lib/babel-session';
import AgentAvatar from '@/components/agentes/AgentAvatar';
import PageTour, { type TourStep } from '@/components/ui/executive/PageTour';
import Link from 'next/link';
import {
  type PlanLang,
  type EntornoTipo,
  type Objetivo,
  type AmenazaOportunidad,
  type FortalezaDebilidad,
  type Proyecto,
  type Accion,
  type OrgAssignments,
  type PerspectivaEstilo,
  STORAGE_KEY,
  ORG_KEY,
  BOARD_KEY,
  INDICADORES_KEY,
  ROLE_OPTIONS,
  priorityRank,
  suggestedDate,
  generateId,
  isFactibilidad,
  isImpacto,
  isEntornoTipo,
  objetivosDe,
  entornosDe,
  newEntorno,
  newFD,
  newProyecto,
  newAccion,
  newObjetivo,
  daysUntil,
  PERSPECTIVAS,
  perspectivaEstilo,
  perspectivaLabel,
  resumenDeObjetivo,
  LABELS,
} from '@/lib/plan-accion';

const MATURITY_LEVEL_LABEL: Record<string, { es: string; en: string }> = {
  execution: { es: 'Ejecucion', en: 'Execution' },
  standard: { es: 'Estandar', en: 'Standard' },
  control: { es: 'Control', en: 'Control' },
  optimization: { es: 'Optimizacion', en: 'Optimization' },
  excellence: { es: 'Excelencia', en: 'Excellence' },
  influencer: { es: 'Influencer', en: 'Influencer' },
};

interface RawEntornoIA {
  objetivoIds?: string[];
  objetivoId?: string;
  tipo?: string;
  descripcion?: string;
}

interface RawCapacidadIA {
  entornoIds?: string[];
  entornoId?: string;
  tipo?: string;
  descripcion?: string;
}

interface RawAccionIA {
  fdId?: string;
  descripcion?: string;
  entregable?: string;
}

interface RawPrioridadIA {
  id?: string;
  factibilidad?: string;
  impacto?: string;
  responsableRoleKey?: string;
  justificacion?: string;
}

// Extrae de un resumen de reflexion las secciones numeradas indicadas
// (claves como "1.2" o "2"), apoyandose en marcadores como "1.2)" o "2.".
// Si el texto no tiene marcadores numerados, devuelve un recorte plano.
function extraerSecciones(texto: string, claves: string[]): string {
  const textoTrim = (texto || '').trim();
  if (!textoTrim) return '';
  const porClave: Record<string, string[]> = {};
  const re = /^\s*(\d+(?:\.\d+)?)[.)]?\s*/;
  textoTrim.split(/\n+/).forEach((linea) => {
    const m = linea.match(re);
    if (!m) return;
    const clave = m[1];
    if (!porClave[clave]) porClave[clave] = [];
    porClave[clave].push(linea);
  });
  const extraido: string[] = [];
  claves.forEach((c) => {
    if (porClave[c] && porClave[c].length > 0) extraido.push(porClave[c].join('\n'));
  });
  if (extraido.length > 0) return extraido.join('\n\n');
  return textoTrim.slice(0, 4000);
}

const PASOS_TOUR: Record<'es' | 'en', TourStep[]> = {
  es: [
    { selector: '#plan-accion-title', title: 'Plan de Acción Estratégico', description: 'Aquí construyes tu plan paso a paso: Babel te acompaña con sugerencias de IA y todo se guarda automáticamente.' },
    { selector: '#plan-accion-etapas', title: 'Cuatro etapas con Babel', description: 'Cada botón genera una capa del plan: Amenazas y Oportunidades, Fortalezas y Debilidades, Acciones, y Factibilidad e Impacto. Se procesan en orden.' },
    { selector: '#plan-paso-entornos', title: '1. Amenazas y Oportunidades', description: 'Babel analiza las fases aprobadas de tu sesión y detecta riesgos y oportunidades para cada objetivo estratégico. Una amenaza puede impactar varios objetivos.' },
    { selector: '#plan-paso-fds', title: '2. Fortalezas y Debilidades', description: 'Revisa tus capacidades internas y tu nivel de madurez para sustentar cada amenaza u oportunidad detectada.' },
    { selector: '#plan-paso-acciones', title: '3. Sugiere Acciones', description: 'Propone acciones concretas a partir de las fases, las pendientes de madurez y las buenas prácticas del catálogo.' },
    { selector: '#plan-paso-prioridad', title: '4. Factibilidad e Impacto', description: 'Asigna la factibilidad, el impacto y el responsable según tu organigrama para cada acción.' },
    { selector: '#plan-accion-mapa', title: 'Tu plan en el mapa', description: 'Cada objetivo se agrupa por perspectiva del Balanced Scorecard. Toca "Ver plan" para abrir la pagina del objetivo con sus acciones y su diagnostico.' },
  ],
  en: [
    { selector: '#plan-accion-title', title: 'Strategic Action Plan', description: 'Build your plan step by step: Babel accompanies you with AI suggestions and everything is saved automatically.' },
    { selector: '#plan-accion-etapas', title: 'Four stages with Babel', description: 'Each button generates a layer of the plan: Threats and Opportunities, Strengths and Weaknesses, Actions, and Feasibility and Impact. They run in order.' },
    { selector: '#plan-paso-entornos', title: '1. Threats and Opportunities', description: 'Babel analyzes the approved phases of your session and detects risks and opportunities for each strategic objective. One threat can impact several objectives.' },
    { selector: '#plan-paso-fds', title: '2. Strengths and Weaknesses', description: 'Review your internal capabilities and maturity level to support each detected threat or opportunity.' },
    { selector: '#plan-paso-acciones', title: '3. Suggest Actions', description: 'Proposes concrete actions from the phases, maturity pending items and the best practices catalog.' },
    { selector: '#plan-paso-prioridad', title: '4. Feasibility and Impact', description: 'Assigns feasibility, impact and the responsible role from your org chart for each action.' },
    { selector: '#plan-accion-mapa', title: 'Your plan on the map', description: 'Each objective is grouped by Balanced Scorecard perspective. Tap "View plan" to open the objective page with its actions and diagnosis.' },
  ],
};

export default function PlanAccionBuilder({ lang }: { lang: PlanLang }) {
  const t = LABELS[lang];
  const [translationCache, setTranslationCache] = React.useState<Record<string, string>>({});
  const tr = React.useCallback(function (text: string): string {
    if (lang === 'es' || !text) return text;
    return translationCache[text] ?? text;
  }, [lang, translationCache]);
  const [objetivos, setObjetivos] = React.useState<Objetivo[]>([]);
  const [entornos, setEntornos] = React.useState<AmenazaOportunidad[]>([]);
  const [fds, setFds] = React.useState<FortalezaDebilidad[]>([]);
  const [proyectos, setProyectos] = React.useState<Proyecto[]>([]);
  const [acciones, setAcciones] = React.useState<Accion[]>([]);
  const [prioGenerating, setPrioGenerating] = React.useState(false);
  const [prioGenError, setPrioGenError] = React.useState('');
  const [pasoGenerando, setPasoGenerando] = React.useState<'entornos' | 'fds' | 'acciones' | null>(null);
  const [planError, setPlanError] = React.useState('');
  const [loaded, setLoaded] = React.useState(false);
  const [etapasOpen, setEtapasOpen] = React.useState(true);
  const [orgAssignments, setOrgAssignments] = React.useState<OrgAssignments>({});
  const [boardPresidente, setBoardPresidente] = React.useState('');
  const [boardSecretario, setBoardSecretario] = React.useState('');
  const [boardConsejeros, setBoardConsejeros] = React.useState<{ id: string; nombre: string }[]>([]);
  const [authUser, setAuthUser] = React.useState<User | null>(null);
  const [madurezResult, setMadurezResult] = React.useState<AssessmentResult | null>(null);
  const [babelFase1Summary, setBabelFase1Summary] = React.useState('');
  const [babelFase2Summary, setBabelFase2Summary] = React.useState('');
  const [babelFase3Summary, setBabelFase3Summary] = React.useState('');
  const [babelFase4Summary, setBabelFase4Summary] = React.useState('');

  React.useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => setAuthUser(u));
    return unsubscribe;
  }, []);

  React.useEffect(() => {
    if (!authUser) {
      setMadurezResult(null);
      setBabelFase1Summary('');
      setBabelFase2Summary('');
      setBabelFase3Summary('');
      setBabelFase4Summary('');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const answers = await getLatestAssessmentAnswers(authUser.uid);
        if (!cancelled && answers) {
          const dims = getMaturityDimensions(lang);
          setMadurezResult(computeResults(dims, answers));
        }
      } catch (err) {
        console.error(err);
      }
      try {
        const session = await getBabelSessionIfExists(authUser.uid);
        if (!cancelled && session) {
          const phases = session.phases || [];
          const fase1 = phases.find((p) => p.phase === 1 && p.approved);
          const fase2 = phases.find((p) => p.phase === 2 && p.approved);
          const fase3 = phases.find((p) => p.phase === 3 && p.approved);
          const fase4 = phases.find((p) => p.phase === 4 && p.approved);
          if (fase1 && fase1.summary) setBabelFase1Summary(fase1.summary);
          if (fase2 && fase2.summary) setBabelFase2Summary(fase2.summary);
          if (fase3 && fase3.summary) setBabelFase3Summary(fase3.summary);
          if (fase4 && fase4.summary) setBabelFase4Summary(fase4.summary);
        }
      } catch (err) {
        console.error(err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authUser, lang]);

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.objetivos)) setObjetivos(parsed.objetivos);
        if (parsed && Array.isArray(parsed.entornos)) {
          setEntornos(
            parsed.entornos.map((e: { objetivoIds?: string[]; objetivoId?: unknown }) =>
              Object.assign({}, e, { objetivoIds: objetivosDe(e) })
            )
          );
        }
        if (parsed && Array.isArray(parsed.fds)) {
          setFds(
            parsed.fds.map((f: { entornoIds?: string[]; entornoId?: unknown }) =>
              Object.assign({}, f, { entornoIds: entornosDe(f) })
            )
          );
        }
        if (parsed && Array.isArray(parsed.proyectos)) setProyectos(parsed.proyectos);
        if (parsed && Array.isArray(parsed.acciones)) setAcciones(parsed.acciones);
        setEtapasOpen(!(Array.isArray(parsed.objetivos) && parsed.objetivos.length > 0));
      }
    } catch (err) {
      console.error(err);
    }
    try {
      const rawOrg = window.localStorage.getItem(ORG_KEY);
      if (rawOrg) {
        const parsedOrg = JSON.parse(rawOrg);
        if (parsedOrg && typeof parsedOrg === 'object') setOrgAssignments(parsedOrg);
      }
    } catch (err) {
      console.error(err);
    }
    try {
      const rawBoard = window.localStorage.getItem(BOARD_KEY);
      if (rawBoard) {
        const parsedBoard = JSON.parse(rawBoard);
        if (parsedBoard && typeof parsedBoard.presidente === 'string') setBoardPresidente(parsedBoard.presidente);
        if (parsedBoard && typeof parsedBoard.secretario === 'string') setBoardSecretario(parsedBoard.secretario);
        if (parsedBoard && Array.isArray(parsedBoard.consejeros)) {
          setBoardConsejeros(
            parsedBoard.consejeros
              .filter((c: unknown) => c && typeof c === 'object' && typeof (c as { id?: unknown }).id === 'string')
              .map((c: { id: string; nombre?: unknown }) => ({ id: c.id, nombre: typeof c.nombre === 'string' ? c.nombre : '' }))
          );
        }
      }
    } catch (err) {
      console.error(err);
    }
    setLoaded(true);
  }, []);

  React.useEffect(() => {
    if (!loaded) return;
    try {
      const raw = window.localStorage.getItem(INDICADORES_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      const porNombre: Record<string, { nombre: string; perspectiva?: string }> = {};
      parsed.forEach((ind) => {
        const rawObj = ind as { nombre?: unknown; objetivo?: unknown; perspectiva?: unknown };
        const nombre =
          rawObj && typeof rawObj.nombre === 'string' && rawObj.nombre.trim()
            ? rawObj.nombre.trim()
            : rawObj && typeof rawObj.objetivo === 'string'
              ? rawObj.objetivo.trim()
              : '';
        if (!nombre) return;
        const clave = nombre.toLowerCase();
        const perspectiva = rawObj && typeof rawObj.perspectiva === 'string' && rawObj.perspectiva ? rawObj.perspectiva : undefined;
        if (!porNombre[clave]) porNombre[clave] = { nombre, perspectiva };
      });
      if (Object.keys(porNombre).length === 0) return;
      setObjetivos((prev) => {
        const existentes: Record<string, boolean> = {};
        prev.forEach((o) => {
          existentes[o.texto.trim().toLowerCase()] = true;
        });
        const conPerspectiva = prev.map((o) => {
          if (o.perspectiva) return o;
          const hit = porNombre[o.texto.trim().toLowerCase()];
          if (!hit || !hit.perspectiva) return o;
          return Object.assign({}, o, { perspectiva: hit.perspectiva });
        });
        const nuevos: Objetivo[] = [];
        Object.keys(porNombre).forEach((clave) => {
          if (existentes[clave]) return;
          existentes[clave] = true;
          const hit = porNombre[clave];
          nuevos.push({ id: generateId(), texto: hit.nombre, validado: false, perspectiva: hit.perspectiva });
        });
        return nuevos.length > 0 ? conPerspectiva.concat(nuevos) : conPerspectiva;
      });
    } catch (err) {
      console.error(err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  React.useEffect(() => {
    if (!loaded || lang === 'es') return;
    const texts = new Set<string>();
    objetivos.forEach(function (o) { if (o.texto) texts.add(o.texto); });
    entornos.forEach(function (e) { if (e.descripcion) texts.add(e.descripcion); });
    fds.forEach(function (f) { if (f.descripcion) texts.add(f.descripcion); });
    acciones.forEach(function (a) {
      if (a.descripcion) texts.add(a.descripcion);
      if (a.entregable) texts.add(a.entregable);
    });
    texts.forEach(function (text) {
      if (translationCache[text] !== undefined) return;
      fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, targetLang: 'en' }),
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          const translated = data && typeof data.translation === 'string' ? data.translation : text;
          setTranslationCache(function (prev) { return { ...prev, [text]: translated }; });
        })
        .catch(function () {
          setTranslationCache(function (prev) { return { ...prev, [text]: text }; });
        });
    });
  }, [loaded, lang, objetivos, entornos, fds, acciones]);

  React.useEffect(() => {
    if (!loaded) return;
    try {
      const blob = {
        objetivos: objetivos,
        entornos: entornos,
        fds: fds,
        proyectos: proyectos,
        acciones: acciones,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(blob));
    } catch (err) {
      console.error(err);
    }
  }, [objetivos, entornos, fds, proyectos, acciones, loaded]);

  const resolvePersonForRole = (roleKey: string): string => {
    if (!roleKey) return '';
    if (roleKey === 'consejo_administrativo') return boardPresidente;
    const a = orgAssignments[roleKey];
    return a && a.person ? a.person : '';
  };

  const findProyectoByFd = (fdId: string): Proyecto | undefined => {
    for (let i = 0; i < proyectos.length; i++) {
      if (proyectos[i].fdId === fdId) return proyectos[i];
    }
    return undefined;
  };

  const addObjetivo = () => setObjetivos((prev) => prev.concat([newObjetivo()]));
  const updateObjetivo = (id: string, patch: Partial<Objetivo>) =>
    setObjetivos((prev) => prev.map((o) => (o.id === id ? Object.assign({}, o, patch) : o)));
  const removeObjetivo = (id: string) => {
    const entornosNuevos = entornos
      .map((e) =>
        e.objetivoIds.indexOf(id) !== -1 ? Object.assign({}, e, { objetivoIds: e.objetivoIds.filter((x) => x !== id) }) : e
      )
      .filter((e) => e.objetivoIds.length > 0);
    const entornosVivosIds = new Set(entornosNuevos.map((e) => e.id));
    const fdsVivos = fds.filter((f) => f.entornoIds.length > 0 && f.entornoIds.some((eid) => entornosVivosIds.has(eid)));
    const fdsVivosIds = new Set(fdsVivos.map((f) => f.id));
    const proyectosToRemove = proyectos.filter((p) => !fdsVivosIds.has(p.fdId)).map((p) => p.id);
    setObjetivos((prev) => prev.filter((o) => o.id !== id));
    setEntornos(entornosNuevos);
    setFds(fdsVivos);
    setProyectos((prev) => prev.filter((p) => fdsVivosIds.has(p.fdId)));
    setAcciones((prev) => prev.filter((a) => proyectosToRemove.indexOf(a.proyectoId) === -1));
  };

  const updateEntorno = (id: string, patch: Partial<AmenazaOportunidad>) =>
    setEntornos((prev) => prev.map((e) => (e.id === id ? Object.assign({}, e, patch) : e)));
  const updateFD = (id: string, patch: Partial<FortalezaDebilidad>) =>
    setFds((prev) => prev.map((f) => (f.id === id ? Object.assign({}, f, patch) : f)));
  const updateAccion = (id: string, patch: Partial<Accion>) =>
    setAcciones((prev) =>
      prev.map((a) => {
        if (a.id !== id) return a;
        const merged = Object.assign({}, a, patch);
        const oldSuggested = suggestedDate(priorityRank(a.factibilidad, a.impacto));
        if ((patch.factibilidad || patch.impacto) && (!a.fecha || a.fecha === oldSuggested)) {
          merged.fecha = suggestedDate(priorityRank(merged.factibilidad, merged.impacto));
        }
        return merged;
      })
    );

  const buildAccionesParaIA = (): Array<{ id: string; descripcion: string; entregable: string; contexto: string; responsableRoleKey: string }> => {
    const out: Array<{ id: string; descripcion: string; entregable: string; contexto: string; responsableRoleKey: string }> = [];
    const vistos: Record<string, boolean> = {};
    objetivos.forEach((o) => {
      const entornosDeO = entornos.filter((e) => e.objetivoIds.indexOf(o.id) !== -1);
      entornosDeO.forEach((e) => {
        const fdsDeE = fds.filter((f) => f.entornoIds.indexOf(e.id) !== -1);
        fdsDeE.forEach((f) => {
          const proyectosDeF = proyectos.filter((p) => p.fdId === f.id);
          proyectosDeF.forEach((p) => {
            const accionesDeP = acciones.filter((a) => a.proyectoId === p.id && !a.validado);
            accionesDeP.forEach((a) => {
              if (vistos[a.id]) return;
              vistos[a.id] = true;
              const contexto =
                'Objetivo: ' + o.texto + ' | ' + (e.tipo === 'amenaza' ? 'Amenaza' : 'Oportunidad') + ': ' + e.descripcion;
              out.push({ id: a.id, descripcion: a.descripcion, entregable: a.entregable, contexto: contexto, responsableRoleKey: a.responsableRoleKey || '' });
            });
          });
        });
      });
    });
    return out;
  };

  const buildRolesParaIA = (): { key: string; name: string; person: string }[] => {
    return ROLE_OPTIONS.map((opt) => ({
      key: opt.key,
      name: lang === 'en' ? opt.nameEn : opt.nameEs,
      person: resolvePersonForRole(opt.key),
    }));
  };

  const sugerirPrioridadConIA = async () => {
    setPrioGenerating(true);
    setPrioGenError('');
    try {
      const payload = buildAccionesParaIA();
      if (payload.length === 0) {
        setPrioGenError(lang === 'en' ? 'There are no actions yet to evaluate.' : 'Todavia no hay acciones para evaluar.');
        return;
      }
      const res = await fetch('/api/babel/indicadores/priorizacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: lang, acciones: payload, roles: buildRolesParaIA() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || !Array.isArray(data.sugerencias)) {
        setPrioGenError((data && data.error) || (lang === 'en' ? 'Unknown error contacting Babel.' : 'Error desconocido al contactar a Babel.'));
        return;
      }
      (data.sugerencias as RawPrioridadIA[]).forEach((raw) => {
        const id = (raw.id || '').trim();
        if (!id) return;
        const existe = acciones.some((a) => a.id === id);
        if (!existe) return;
        const factRaw = (raw.factibilidad || '').trim().toLowerCase();
        const impRaw = (raw.impacto || '').trim().toLowerCase();
        if (!isFactibilidad(factRaw) || !isImpacto(impRaw)) return;
        const patch: Partial<Accion> = { factibilidad: factRaw, impacto: impRaw, validado: false };
        const roleRaw = (raw.responsableRoleKey || '').trim();
        if (roleRaw && ROLE_OPTIONS.some((opt) => opt.key === roleRaw)) {
          patch.responsableRoleKey = roleRaw;
          const persona = resolvePersonForRole(roleRaw);
          if (persona) patch.responsableNombre = persona;
        }
        updateAccion(id, patch);
      });
    } finally {
      setPrioGenerating(false);
    }
  };

  const contextoPorFases = (claves: string[]): string => {
    const fases = [babelFase1Summary, babelFase2Summary, babelFase3Summary, babelFase4Summary];
    const partes: string[] = [];
    fases.forEach((f, i) => {
      const extraido = extraerSecciones(f, claves);
      if (extraido) {
        partes.push((lang === 'en' ? 'Phase ' : 'Fase ') + (i + 1) + ':\n' + extraido);
      }
    });
    return partes.join('\n\n');
  };

  const contextoFasesCompleto = (): string => {
    const fases = [babelFase1Summary, babelFase2Summary, babelFase3Summary, babelFase4Summary];
    const partes: string[] = [];
    fases.forEach((f, i) => {
      const t = (f || '').trim();
      if (t) {
        partes.push((lang === 'en' ? 'Phase ' : 'Fase ') + (i + 1) + ':\n' + t);
      }
    });
    return partes.join('\n\n');
  };

  const madurezDebilidadesParaIA = (): string => {
    if (!madurezResult) return '';
    const lines: string[] = [];
    madurezResult.dimensions.forEach((d) => {
      if (d.level !== 'execution' && d.level !== 'standard') return;
      const labelSet = MATURITY_LEVEL_LABEL[d.level];
      const label = labelSet ? labelSet[lang] : d.level;
      const detalle = d.nextStep ? d.nextStep.description : '';
      lines.push('- ' + d.tema + ' (nivel actual: ' + label + ')' + (detalle ? ': ' + detalle : ''));
    });
    return lines.join('\n');
  };

  const madurezPendientesParaIA = (): string => {
    if (!madurezResult) return '';
    const lines: string[] = [];
    madurezResult.dimensions.forEach((d) => {
      if (!d.nextStep) return;
      const labelSet = MATURITY_LEVEL_LABEL[d.level];
      const label = labelSet ? labelSet[lang] : d.level;
      const desc = d.nextStep.description + (d.nextStep.deliverable ? ' | Entregable: ' + d.nextStep.deliverable : '');
      lines.push('- ' + d.tema + ' (nivel actual: ' + label + '): ' + desc);
    });
    return lines.join('\n');
  };

  const sugerirEntornosConIA = async () => {
    if (pasoGenerando) return;
    if (objetivos.length === 0) {
      setPlanError(t.detectaEntornosNeed);
      return;
    }
    setPasoGenerando('entornos');
    setPlanError('');
    try {
      const objetivosParaIA = objetivos.map((o) => ({ id: o.id, texto: o.texto }));
      const contexto = contextoPorFases(['1.2', '1.4', '2.1', '2.2', '2.3', '4.1']);
      const res = await fetch('/api/babel/extractor-plan-accion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: lang,
          paso: 'entornos',
          objetivos: objetivosParaIA,
          contextoFases: contexto,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || !Array.isArray(data.sugerencias)) {
        setPlanError((data && data.error) || (lang === 'en' ? 'Unknown error contacting Babel.' : 'Error desconocido al contactar a Babel.'));
        return;
      }
      const objetivoIds = objetivos.map((o) => o.id);
      const trabajo: Record<string, AmenazaOportunidad> = {};
      const esNuevo: Record<string, boolean> = {};
      entornos.forEach((e) => {
        trabajo[e.descripcion.trim().toLowerCase()] = e;
      });
      const nuevos: AmenazaOportunidad[] = [];
      const actualizaciones: { id: string; objetivoIds: string[] }[] = [];
      (data.sugerencias as RawEntornoIA[]).forEach((raw) => {
        const tipoRaw = (raw.tipo || '').trim().toLowerCase();
        const descripcion = (raw.descripcion || '').trim();
        if (!isEntornoTipo(tipoRaw)) return;
        if (!descripcion) return;
        const ids = objetivosDe(raw)
          .map((x) => x.trim())
          .filter((x) => x && objetivoIds.indexOf(x) !== -1);
        if (ids.length === 0) return;
        const clave = descripcion.toLowerCase();
        const existente = trabajo[clave];
        if (existente) {
          if (existente.tipo !== tipoRaw) return;
          const aAgregar = ids.filter((x) => existente.objetivoIds.indexOf(x) === -1);
          if (aAgregar.length === 0) return;
          const merged = existente.objetivoIds.concat(aAgregar);
          if (esNuevo[clave]) {
            existente.objetivoIds = merged;
          } else {
            actualizaciones.push({ id: existente.id, objetivoIds: merged });
          }
          trabajo[clave] = Object.assign({}, existente, { objetivoIds: merged });
        } else {
          const eo = newEntorno(ids, tipoRaw);
          eo.descripcion = descripcion;
          trabajo[clave] = eo;
          esNuevo[clave] = true;
          nuevos.push(eo);
        }
      });
      if (nuevos.length > 0) {
        setEntornos((prev) => prev.concat(nuevos));
      }
      actualizaciones.forEach((u) => updateEntorno(u.id, { objetivoIds: u.objetivoIds }));
    } finally {
      setPasoGenerando(null);
    }
  };

  const sugerirFdsConIA = async () => {
    if (pasoGenerando) return;
    if (entornos.length === 0) {
      setPlanError(t.fdsNeedEntornos);
      return;
    }
    setPasoGenerando('fds');
    setPlanError('');
    try {
      const entornosParaIA = entornos.map((e) => ({ id: e.id, tipo: e.tipo, descripcion: e.descripcion }));
      const contexto = contextoPorFases(['1.1', '1.3', '3.1', '3.2', '3.3', '4.2']);
      const madurezDebilidades = madurezDebilidadesParaIA();
      const res = await fetch('/api/babel/extractor-plan-accion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: lang,
          paso: 'fds',
          entornos: entornosParaIA,
          contextoFases: contexto,
          madurezDebilidades: madurezDebilidades,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || !Array.isArray(data.sugerencias)) {
        setPlanError((data && data.error) || (lang === 'en' ? 'Unknown error contacting Babel.' : 'Error desconocido al contactar a Babel.'));
        return;
      }
      const entornoIds = entornos.map((e) => e.id);
      const trabajo: Record<string, FortalezaDebilidad> = {};
      const esNuevo: Record<string, boolean> = {};
      fds.forEach((f) => {
        trabajo[f.descripcion.trim().toLowerCase()] = f;
      });
      const nuevos: FortalezaDebilidad[] = [];
      const actualizaciones: { id: string; entornoIds: string[] }[] = [];
      (data.sugerencias as RawCapacidadIA[]).forEach((raw) => {
        const tipoRaw = (raw.tipo || '').trim().toLowerCase();
        const descripcion = (raw.descripcion || '').trim();
        if (tipoRaw !== 'fortaleza' && tipoRaw !== 'debilidad') return;
        if (!descripcion) return;
        const ids = entornosDe(raw)
          .map((x) => x.trim())
          .filter((x) => x && entornoIds.indexOf(x) !== -1);
        if (ids.length === 0) return;
        const clave = descripcion.toLowerCase();
        const existente = trabajo[clave];
        if (existente) {
          if (existente.tipo !== tipoRaw) return;
          const aAgregar = ids.filter((x) => existente.entornoIds.indexOf(x) === -1);
          if (aAgregar.length === 0) return;
          const merged = existente.entornoIds.concat(aAgregar);
          if (esNuevo[clave]) {
            existente.entornoIds = merged;
          } else {
            actualizaciones.push({ id: existente.id, entornoIds: merged });
          }
          trabajo[clave] = Object.assign({}, existente, { entornoIds: merged });
        } else {
          const fd = newFD(ids, tipoRaw);
          fd.descripcion = descripcion;
          trabajo[clave] = fd;
          esNuevo[clave] = true;
          nuevos.push(fd);
        }
      });
      if (nuevos.length > 0) {
        setFds((prev) => prev.concat(nuevos));
      }
      actualizaciones.forEach((u) => updateFD(u.id, { entornoIds: u.entornoIds }));
    } finally {
      setPasoGenerando(null);
    }
  };

  const sugerirAccionesPlanConIA = async () => {
    if (pasoGenerando) return;
    if (fds.length === 0) {
      setPlanError(t.accionesNeedFds);
      return;
    }
    setPasoGenerando('acciones');
    setPlanError('');
    try {
      const fdsParaIA = fds.map((f) => ({ id: f.id, tipo: f.tipo, descripcion: f.descripcion }));
      const contexto = contextoFasesCompleto();
      const madurezPendientes = madurezPendientesParaIA();
      const res = await fetch('/api/babel/extractor-plan-accion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: lang,
          paso: 'acciones',
          fds: fdsParaIA,
          contextoFases: contexto,
          madurezPendientes: madurezPendientes,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || !Array.isArray(data.sugerencias)) {
        setPlanError((data && data.error) || (lang === 'en' ? 'Unknown error contacting Babel.' : 'Error desconocido al contactar a Babel.'));
        return;
      }
      const fdIds = fds.map((f) => f.id);
      const existentes: Record<string, boolean> = {};
      acciones.forEach((a) => {
        if (a.descripcion) existentes[a.descripcion.trim().toLowerCase()] = true;
      });
      const nuevosProyectos: Proyecto[] = [];
      const nuevas: Accion[] = [];
      (data.sugerencias as RawAccionIA[]).forEach((raw) => {
        const fdId = (raw.fdId || '').trim();
        const descripcion = (raw.descripcion || '').trim();
        if (!fdId || fdIds.indexOf(fdId) === -1) return;
        if (!descripcion) return;
        const clave = descripcion.toLowerCase();
        if (existentes[clave]) return;
        existentes[clave] = true;
        let proyecto = findProyectoByFd(fdId);
        if (!proyecto) {
          proyecto = newProyecto(fdId);
          nuevosProyectos.push(proyecto);
        }
        const nueva = newAccion(proyecto.id, priorityRank('media', 'medio'));
        nueva.descripcion = descripcion;
        nueva.entregable = (raw.entregable || '').trim();
        nuevas.push(nueva);
      });
      if (nuevosProyectos.length > 0) {
        setProyectos((prev) => prev.concat(nuevosProyectos));
      }
      if (nuevas.length > 0) {
        setAcciones((prev) => prev.concat(nuevas));
        // Identifica en paralelo, con base en el catalogo de buenas practicas
        // (y contexto por IA si una accion no coincide con nada del
        // catalogo), que mentor puede ayudar a implementar cada accion
        // sugerida.
        Promise.all(
          nuevas.map((n) =>
            fetch('/api/babel/clasificar-mentor', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ descripcion: n.descripcion, language: lang }),
            })
              .then((r) => r.json())
              .then((d) => ({ id: n.id, mentor: typeof d?.mentor === 'string' ? d.mentor : '' }))
              .catch(() => ({ id: n.id, mentor: '' }))
          )
        ).then((resultados) => {
          const porId: Record<string, string> = {};
          resultados.forEach((r) => {
            if (r.mentor) porId[r.id] = r.mentor;
          });
          if (Object.keys(porId).length > 0) {
            setAcciones((prev) => prev.map((a) => (porId[a.id] ? Object.assign({}, a, { mentor: porId[a.id] }) : a)));
          }
        });
      }
    } finally {
      setPasoGenerando(null);
    }
  };

  const vencidas = acciones.filter((a) => a.estatus !== 'terminado' && daysUntil(a.fecha) < 0);
  const porVencer = acciones.filter((a) => {
    const d = daysUntil(a.fecha);
    return a.estatus !== 'terminado' && d >= 0 && d <= 7;
  });
  let pendientesValidar = 0;
  objetivos.forEach((o) => {
    if (!o.validado) pendientesValidar = pendientesValidar + 1;
  });
  entornos.forEach((e) => {
    if (!e.validado) pendientesValidar = pendientesValidar + 1;
  });
  fds.forEach((f) => {
    if (!f.validado) pendientesValidar = pendientesValidar + 1;
  });
  proyectos.forEach((p) => {
    if (!p.validado) pendientesValidar = pendientesValidar + 1;
  });
  acciones.forEach((a) => {
    if (!a.validado) pendientesValidar = pendientesValidar + 1;
  });

  const ValidateBadge = (props: { validado: boolean; onToggle: () => void }) => {
    return (
      <button
        type="button"
        onClick={props.onToggle}
        className={
          'rounded-full px-2.5 py-1 text-xs font-medium ' +
          (props.validado ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800')
        }
      >
        {props.validado ? t.validado : t.pendienteValidar}
      </button>
    );
  };

  const GRUPO_KEYS: string[] = ['financiera', 'clientes', 'procesos_internos', 'aprendizaje_crecimiento', 'socioambiental', 'sin_perspectiva'];

  const grupos = GRUPO_KEYS.map((key) => ({
    key,
    estilo: perspectivaEstilo(key),
    items: objetivos.filter((o) => (key === 'sin_perspectiva' ? !o.perspectiva : o.perspectiva === key)),
  })).filter((g) => g.items.length > 0);

  const renderGrupoPerspectiva = (g: { key: string; estilo: PerspectivaEstilo; items: Objetivo[] }) => {
    let totalAcciones = 0;
    let validadosAcciones = 0;
    let totalValidados = 0;
    g.items.forEach((o) => {
      const r = resumenDeObjetivo(o.id, { objetivos, entornos, fds, proyectos, acciones });
      totalAcciones = totalAcciones + r.total;
      validadosAcciones = validadosAcciones + r.validados;
      if (o.validado) totalValidados = totalValidados + 1;
    });
    const avance = totalAcciones > 0 ? validadosAcciones / totalAcciones : totalValidados / g.items.length;
    const pct = Math.round(avance * 100);
    return (
      <div key={g.key} className={'rounded-xl border ' + g.estilo.border + ' ' + g.estilo.soft + ' p-3'}>
        <div className="flex items-center justify-between">
          <span className={'rounded-full px-2.5 py-1 text-xs font-medium ' + g.estilo.chip}>
            {perspectivaLabel(g.key, lang)}
          </span>
          <span className="text-xs font-medium text-slate-500">
            {g.items.length} {t.summaryObjetivos}
          </span>
        </div>
        <div className="mt-1.5">
          <span className="text-[11px] text-slate-500">
            {totalAcciones} {t.accionesShort} · {t.mapaAvance} {pct}%
          </span>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-teal-500" style={{ width: pct + '%' }} />
          </div>
        </div>
        <div className="mt-2">
          {g.items.map((o) => {
            const r = resumenDeObjetivo(o.id, { objetivos, entornos, fds, proyectos, acciones });
            return (
              <div key={o.id} className="mt-2 rounded-lg border border-slate-200 bg-white/60 p-2">
                <div className="flex items-start justify-between gap-2">
                  <input
                    type="text"
                    value={tr(o.texto)}
                    onChange={(ev) => updateObjetivo(o.id, { texto: ev.target.value })}
                    placeholder={t.objetivoPlaceholder}
                    className="w-full bg-transparent text-sm font-medium text-slate-800 outline-none"
                  />
                  <Link
                    href={'/' + lang + '/babel/plan-accion/objetivo/' + o.id}
                    className="shrink-0 rounded-lg bg-teal-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-teal-700"
                  >
                    {t.verPlan}
                  </Link>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <span className={'rounded-full px-2 py-0.5 text-[11px] font-medium ' + g.estilo.chip}>
                    {perspectivaLabel(o.perspectiva || '', lang)}
                  </span>
                  <select
                    value={o.perspectiva || ''}
                    onChange={(ev) => updateObjetivo(o.id, { perspectiva: ev.target.value || undefined })}
                    className="rounded-lg border border-slate-300 px-1.5 py-0.5 text-[11px]"
                    aria-label={t.perspectivaLabel}
                  >
                    <option value="">{t.sinPerspectiva}</option>
                    {PERSPECTIVAS.map((p) => (
                      <option key={p.key} value={p.key}>
                        {lang === 'en' ? p.en : p.es}
                      </option>
                    ))}
                  </select>
                  <span className="text-[11px] text-slate-500">
                    {r.total} {t.accionesShort} · {r.pendientes} {t.pendientesShort} · {r.vencidas} {t.vencidasShort}
                  </span>
                  <span className="ml-auto flex items-center gap-2">
                    <ValidateBadge validado={o.validado} onToggle={() => updateObjetivo(o.id, { validado: !o.validado })} />
                    <button type="button" onClick={() => removeObjetivo(o.id)} className="text-xs font-medium text-red-600 hover:underline">
                      {t.eliminar}
                    </button>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center gap-3">
        <AgentAvatar
          agente="Babel"
          pose={pasoGenerando !== null || prioGenerating ? 'guiando' : 'reposando'}
          size={56}
          className="shrink-0"
        />
        <div>
          <h3 id="plan-accion-title" className="text-xl font-bold text-slate-800">{t.title}</h3>
          <p className="mt-1 text-sm text-slate-500">{t.subtitle}</p>
        </div>
        <a
          href={'/' + (lang === 'en' ? 'en' : 'es') + '/worlds/estrategia'}
          className="ml-auto rounded-lg border border-teal-400/60 bg-white/40 px-4 py-2 text-sm font-bold text-teal-700 backdrop-blur-md transition hover:bg-white/70 dark:bg-white/10 dark:text-teal-200 dark:hover:bg-white/20"
        >
          {lang === 'en' ? '← Back to the Strategy map' : '← Regresar al mapa de la Estrategia'}
        </a>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="glass-panel p-3 text-center">
          <div className="text-lg font-bold text-slate-800">{objetivos.length}</div>
          <div className="text-xs text-slate-500">{t.summaryObjetivos}</div>
        </div>
        <div className="glass-panel p-3 text-center">
          <div className="text-lg font-bold text-slate-800">{acciones.length}</div>
          <div className="text-xs text-slate-500">{t.summaryAcciones}</div>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-center">
          <div className="text-lg font-bold text-red-700">{vencidas.length}</div>
          <div className="text-xs text-red-600">{t.summaryVencidas}</div>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-center">
          <div className="text-lg font-bold text-amber-700">{porVencer.length}</div>
          <div className="text-xs text-amber-600">{t.summaryPorVencer}</div>
        </div>
        <div className="glass-panel p-3 text-center">
          <div className="text-lg font-bold text-slate-800">{pendientesValidar}</div>
          <div className="text-xs text-slate-500">{t.summaryValidar}</div>
        </div>
      </div>

      <div id="plan-accion-etapas" className="mt-6 glass-panel p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-slate-800">{t.planIaTitle}</h4>
            <p className="mt-1 text-sm text-slate-500">{t.planIaSubtitle}</p>
          </div>
          <button
            type="button"
            onClick={() => setEtapasOpen((prev) => !prev)}
            className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
          >
            {etapasOpen ? t.etapaBotonOcultar : t.etapaBotonMostrar}
          </button>
        </div>
        {etapasOpen ? (
          <div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-teal-200 bg-teal-50 p-3">
            <h5 className="text-sm font-semibold text-teal-800">{t.detectaEntornosBtn}</h5>
            <p className="mt-1 text-xs text-teal-800">{t.detectaEntornosSubtitle}</p>
            <button
              type="button"
              id="plan-paso-entornos"
              onClick={sugerirEntornosConIA}
              disabled={pasoGenerando !== null}
              className="mt-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
            >
              {pasoGenerando === 'entornos' ? t.detectaEntornosGenerando : t.detectaEntornosBtn}
            </button>
          </div>
          <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-3">
            <h5 className="text-sm font-semibold text-cyan-800">{t.fdsBtn}</h5>
            <p className="mt-1 text-xs text-cyan-800">{t.fdsSubtitle}</p>
            <button
              type="button"
              id="plan-paso-fds"
              onClick={sugerirFdsConIA}
              disabled={pasoGenerando !== null}
              className="mt-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700 disabled:opacity-50"
            >
              {pasoGenerando === 'fds' ? t.fdsGenerando : t.fdsBtn}
            </button>
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
            <h5 className="text-sm font-semibold text-blue-900">{t.accionesBtn}</h5>
            <p className="mt-1 text-xs text-blue-900">{t.accionesSubtitle}</p>
            <button
              type="button"
              id="plan-paso-acciones"
              onClick={sugerirAccionesPlanConIA}
              disabled={pasoGenerando !== null}
              className="mt-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {pasoGenerando === 'acciones' ? t.accionesGenerando : t.accionesBtn}
            </button>
          </div>
          <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
            <h5 className="text-sm font-semibold text-indigo-900">{t.sugerirPrioridadBtn}</h5>
            <p className="mt-1 text-xs text-indigo-900">{t.sugerirPrioridadSubtitle}</p>
            <button
              type="button"
              id="plan-paso-prioridad"
              onClick={sugerirPrioridadConIA}
              disabled={prioGenerating}
              className="mt-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {prioGenerating ? t.sugerirPrioridadGenerando : t.sugerirPrioridadBtn}
            </button>
          </div>
        </div>
        {planError ? (
          <div className="mt-3 rounded-lg bg-red-50 p-2 text-xs text-red-700">
            <p>{planError}</p>
            <p className="mt-0.5">{t.planErrorHint}</p>
          </div>
        ) : null}
        {prioGenError ? (
          <div className="mt-3 rounded-lg bg-red-50 p-2 text-xs text-red-700">
            <p>{prioGenError}</p>
            <p className="mt-0.5">{t.sugerirPrioridadErrorHint}</p>
          </div>
        ) : null}
          </div>
        ) : null}
      </div>

      <div id="plan-accion-mapa" className="mt-6">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-slate-800">{t.mapaTitle}</h4>
            <p className="mt-1 text-sm text-slate-500">{t.mapaSubtitle}</p>
          </div>
        </div>
        {grupos.length > 0 ? (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {grupos.map((g) => renderGrupoPerspectiva(g))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">{t.detectaEntornosNeed}</p>
        )}
        <button type="button" onClick={addObjetivo} className="mt-3 text-sm font-medium text-blue-600 hover:underline">
          {t.addObjetivo}
        </button>
      </div>

      <p className="mt-4 text-xs text-slate-400">{t.savedNote}</p>
      <PageTour pageId="plan-accion" steps={lang === 'en' ? PASOS_TOUR.en : PASOS_TOUR.es} lang={lang} />
    </div>
  );
}

'use client';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { downloadFinancialGoalsExcel, computeFinancialGoals, computeFinancialChannels } from '@/lib/deliverables';
import type { FinancialGoalsInput, FinancialGoalsResult, FinancialGoalsChannel } from '@/lib/deliverables';
import { useAuthUidState, scopedKey, hydrateWorkspaceKey } from '@/lib/workspace-scope';

type FinLang = 'es' | 'en';

function toAmountPct(value: number, mode: '$' | '%', unitPrice: number): number {
  if (mode === '%') return value / 100;
  return unitPrice > 0 ? value / unitPrice : 0;
}

interface FinVarItemForm {
  name: string;
  value: number;
  mode: '$' | '%';
}

interface FinProductoForm {
  nombre: string;
  unidades: number;
  unidadMedida: string;
  precio: number;
  participacion: number;
  gastosVariables: FinVarItemForm[];
}

interface FinCanalForm {
  nombre: string;
  participacion: number;
  productos: FinProductoForm[];
}

interface FinSavedForm {
  canales: FinCanalForm[];
  fixedItems: { name: string; amount: number }[];
  desiredProfit: number;
  marketingPct: number;
}

interface FinGoalsSaved {
  id: string;
  input: FinancialGoalsInput;
  result: FinancialGoalsResult;
  savedAt: string;
  form: FinSavedForm;
}

const FIN_GOALS_HISTORY_KEY = 'babel_financial_goals_history_v1';
const FIN_GOALS_LAST_KEY = 'babel_financial_goals_v1';
const FIN_HISTORY_MAX = 10;

function productoIngresos(p: FinProductoForm): number {
  return (p.unidades || 1) * (p.precio || 0);
}

function productoVarPct(p: FinProductoForm): number {
  return p.gastosVariables.reduce(function (s, v) {
    return s + toAmountPct(v.value, v.mode, p.precio || 0);
  }, 0);
}

function formFromInput(inp: FinancialGoalsInput): FinSavedForm {
  const fixedItems = Array.isArray(inp.fixedItems)
    ? inp.fixedItems.map(function (f) { return { name: f.name ?? '', amount: f.amount ?? 0 }; })
    : [];
  const desiredProfit = typeof inp.desiredProfit === 'number' ? inp.desiredProfit : 0;
  const marketingPct = Math.round((inp.marketingPct ?? 0) * 100);
  const hasProducts = Array.isArray(inp.channels) && inp.channels.some(function (c) {
    return Array.isArray(c.products) && c.products.length > 0;
  });
  let canales: FinCanalForm[];
  if (hasProducts) {
    canales = inp.channels.map(function (c) {
      return {
        nombre: c.name ?? '',
        participacion: Math.round((c.pct ?? 0) * 100),
        productos: (c.products ?? []).map(function (p) {
          return {
            nombre: p.name ?? '',
            unidades: typeof p.units === 'number' ? p.units : 0,
            unidadMedida: p.unitMeasure ?? '',
            precio: typeof p.unitPrice === 'number' ? p.unitPrice : 0,
            participacion: Math.round((p.pct ?? 0) * 100),
            gastosVariables: Array.isArray(p.varItems)
              ? p.varItems.map(function (v) { return { name: v.name ?? '', value: (v.pct ?? 0) * 100, mode: '%' as '$' | '%' }; })
              : [],
          };
        }),
      };
    });
  } else {
    const legacyVar: FinVarItemForm[] = Array.isArray(inp.varItems)
      ? inp.varItems.map(function (v) { return { name: v.name ?? '', value: (v.pct ?? 0) * 100, mode: '%' as '$' | '%' }; })
      : [];
    canales = (Array.isArray(inp.channels) ? inp.channels : []).map(function (c) {
      return {
        nombre: c.name ?? '',
        participacion: Math.round((c.pct ?? 0) * 100),
        productos: [
          {
            nombre: '',
            unidades: 0,
            unidadMedida: '',
            precio: typeof inp.unitPrice === 'number' ? inp.unitPrice : 0,
            participacion: Math.round((c.pct ?? 0) * 100),
            gastosVariables: legacyVar.slice(),
          },
        ],
      };
    });
  }
  return { canales: canales, fixedItems: fixedItems, desiredProfit: desiredProfit, marketingPct: marketingPct };
}

function readFinHistory(uid: string | null): FinGoalsSaved[] {
  try {
    const raw = window.localStorage.getItem(scopedKey(FIN_GOALS_HISTORY_KEY, uid));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
    const rawOld = window.localStorage.getItem(scopedKey(FIN_GOALS_LAST_KEY, uid));
    if (rawOld) {
      const parsedOld = JSON.parse(rawOld);
      if (parsedOld && parsedOld.input && parsedOld.result) {
        const migrated: FinGoalsSaved = {
          id: String(parsedOld.savedAt ?? Date.now()),
          input: parsedOld.input,
          result: parsedOld.result,
          savedAt: parsedOld.savedAt ?? new Date().toISOString(),
          form: formFromInput(parsedOld.input),
        };
        writeFinHistory([migrated], uid);
        return [migrated];
      }
    }
  } catch {
    // sin acceso a localStorage o datos corruptos
  }
  return [];
}

function writeFinHistory(list: FinGoalsSaved[], uid: string | null): void {
  try {
    window.localStorage.setItem(scopedKey(FIN_GOALS_HISTORY_KEY, uid), JSON.stringify(list));
    const latest = list[0];
    if (latest) {
      window.localStorage.setItem(
        scopedKey(FIN_GOALS_LAST_KEY, uid),
        JSON.stringify({ input: latest.input, result: latest.result, savedAt: latest.savedAt })
      );
    } else {
      window.localStorage.removeItem(scopedKey(FIN_GOALS_LAST_KEY, uid));
    }
  } catch {
    // sin acceso a localStorage
  }
}

function formatFinDate(savedAt: string, lang: FinLang): string {
  try {
    return new Date(savedAt).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return savedAt;
  }
}

export default function FinancialGoalsBuilder({ lang }: { lang: FinLang }) {
  const [finActive, setFinActive] = React.useState(false);
  const [finStage, setFinStage] = React.useState(1);
  const [finReviewing, setFinReviewing] = React.useState(false);
  const [finSending, setFinSending] = React.useState(false);
  const [finError, setFinError] = React.useState<string | null>(null);
  const [finCanales, setFinCanales] = React.useState<FinCanalForm[]>([]);
  const [finFixedItems, setFinFixedItems] = React.useState<{ name: string; amount: number }[]>([]);
  const [finDesiredProfit, setFinDesiredProfit] = React.useState(0);
  const [finMarketingPct, setFinMarketingPct] = React.useState(0);
  const [finDone, setFinDone] = React.useState(false);
  const [finHistory, setFinHistory] = React.useState<FinGoalsSaved[]>([]);
  const [finMenu, setFinMenu] = React.useState(false);
  const [finEditingId, setFinEditingId] = React.useState<string | null>(null);
  const { uid, ready } = useAuthUidState();

  React.useEffect(function () {
    if (!ready) return;
    let cancelled = false;
    (async function () {
      await Promise.all([
        hydrateWorkspaceKey(uid, 'finanzas-historial', FIN_GOALS_HISTORY_KEY),
        hydrateWorkspaceKey(uid, 'finanzas', FIN_GOALS_LAST_KEY),
      ]);
      if (cancelled) return;
      const list = readFinHistory(uid);
      if (list.length > 0) {
        setFinHistory(list);
        setFinActive(true);
        setFinMenu(true);
      }
    })();
    return function () {
      cancelled = true;
    };
  }, [ready, uid]);

  function resetFin() {
    setFinStage(1);
    setFinReviewing(false);
    setFinSending(false);
    setFinError(null);
    setFinCanales([]);
    setFinFixedItems([]);
    setFinDesiredProfit(0);
    setFinMarketingPct(0);
    setFinDone(false);
    setFinMenu(false);
    setFinEditingId(null);
  }

  function handleStartFinancialGoals() {
    resetFin();
    const list = readFinHistory(uid);
    setFinHistory(list);
    setFinActive(true);
    setFinMenu(list.length > 0);
  }
  function handleNewFinGoals() {
    resetFin();
    setFinActive(true);
  }
  function handleEditSaved(entry: FinGoalsSaved) {
    const f = entry.form ?? formFromInput(entry.input);
    setFinCanales(f.canales.map(function (c) {
      return {
        nombre: c.nombre,
        participacion: c.participacion ?? 0,
        productos: c.productos.map(function (p) {
          return {
            nombre: p.nombre,
            unidades: p.unidades,
            unidadMedida: p.unidadMedida,
            precio: p.precio,
            participacion: p.participacion ?? 0,
            gastosVariables: p.gastosVariables.map(function (v) { return { name: v.name, value: v.value, mode: v.mode }; }),
          };
        }),
      };
    }));
    setFinFixedItems(f.fixedItems.map(function (item) { return { name: item.name, amount: item.amount }; }));
    setFinDesiredProfit(f.desiredProfit);
    setFinMarketingPct(f.marketingPct);
    setFinEditingId(entry.id);
    setFinStage(1);
    setFinReviewing(false);
    setFinError(null);
    setFinMenu(false);
  }
  function handleDeleteSaved(id: string) {
    const next = finHistory.filter(function (h) { return h.id !== id; });
    setFinHistory(next);
    writeFinHistory(next, uid);
  }
  function handleCloseFinancialGoals() {
    resetFin();
    setFinActive(false);
  }

  function addCanal() {
    setFinCanales(function (prev) {
      return [...prev, { nombre: '', participacion: 0, productos: [{ nombre: '', unidades: 1, unidadMedida: '', precio: 0, participacion: 0, gastosVariables: [] }] }];
    });
  }
  function updateCanal(index: number, patch: Partial<{ nombre: string }>) {
    setFinCanales(function (prev) { return prev.map(function (c, i) { return i === index ? { ...c, ...patch } : c; }); });
  }
  function removeCanal(index: number) {
    setFinCanales(function (prev) { return prev.filter(function (_, i) { return i !== index; }); });
  }
  function addProducto(canalIndex: number) {
    setFinCanales(function (prev) {
      return prev.map(function (c, i) {
        return i === canalIndex
          ? { ...c, productos: [...c.productos, { nombre: '', unidades: 1, unidadMedida: '', precio: 0, participacion: 0, gastosVariables: [] }] }
          : c;
      });
    });
  }
  function updateProducto(canalIndex: number, prodIndex: number, patch: Partial<FinProductoForm>) {
    setFinCanales(function (prev) {
      return prev.map(function (c, i) {
        if (i !== canalIndex) return c;
        return { ...c, productos: c.productos.map(function (p, j) { return j === prodIndex ? { ...p, ...patch } : p; }) };
      });
    });
  }
  function removeProducto(canalIndex: number, prodIndex: number) {
    setFinCanales(function (prev) {
      return prev.map(function (c, i) {
        if (i !== canalIndex) return c;
        return { ...c, productos: c.productos.filter(function (_, j) { return j !== prodIndex; }) };
      });
    });
  }
  function duplicarProducto(canalIndex: number, prodIndex: number) {
    setFinCanales(function (prev) {
      return prev.map(function (c, i) {
        if (i !== canalIndex) return c;
        const src = c.productos[prodIndex];
        if (!src) return c;
        const clone: FinProductoForm = {
          nombre: src.nombre,
          unidades: 1,
          unidadMedida: src.unidadMedida,
          precio: src.precio,
          participacion: 0,
          gastosVariables: src.gastosVariables.map(function (v) { return { name: v.name, value: v.value, mode: v.mode }; }),
        };
        return { ...c, productos: [...c.productos.slice(0, prodIndex + 1), clone, ...c.productos.slice(prodIndex + 1)] };
      });
    });
  }
  function updateParticipacion(canalIndex: number, prodIndex: number, value: number) {
    setFinCanales(function (prev) {
      return prev.map(function (c, i) {
        if (i !== canalIndex) return c;
        return {
          ...c,
          productos: c.productos.map(function (p, j) {
            return j === prodIndex ? { ...p, participacion: value } : p;
          }),
        };
      });
    });
  }
  function addGastoVar(canalIndex: number, prodIndex: number) {
    setFinCanales(function (prev) {
      return prev.map(function (c, i) {
        if (i !== canalIndex) return c;
        return {
          ...c,
          productos: c.productos.map(function (p, j) {
            return j === prodIndex ? { ...p, gastosVariables: [...p.gastosVariables, { name: '', value: 0, mode: '$' as '$' | '%' }] } : p;
          }),
        };
      });
    });
  }
  function updateGastoVar(canalIndex: number, prodIndex: number, itemIndex: number, patch: Partial<FinVarItemForm>) {
    setFinCanales(function (prev) {
      return prev.map(function (c, i) {
        if (i !== canalIndex) return c;
        return {
          ...c,
          productos: c.productos.map(function (p, j) {
            if (j !== prodIndex) return p;
            return { ...p, gastosVariables: p.gastosVariables.map(function (v, k) { return k === itemIndex ? { ...v, ...patch } : v; }) };
          }),
        };
      });
    });
  }
  function removeGastoVar(canalIndex: number, prodIndex: number, itemIndex: number) {
    setFinCanales(function (prev) {
      return prev.map(function (c, i) {
        if (i !== canalIndex) return c;
        return {
          ...c,
          productos: c.productos.map(function (p, j) {
            if (j !== prodIndex) return p;
            return { ...p, gastosVariables: p.gastosVariables.filter(function (_, k) { return k !== itemIndex; }) };
          }),
        };
      });
    });
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

  function buildGoalsInput(): FinancialGoalsInput {
    const channels: FinancialGoalsChannel[] = finCanales.map(function (c) {
      return {
        name: c.nombre,
        products: c.productos.map(function (p) {
          const part = p.participacion || 0;
          return {
            name: p.nombre,
            units: p.unidades || 1,
            unitMeasure: p.unidadMedida,
            unitPrice: p.precio || 0,
            varItems: p.gastosVariables.map(function (v) {
              return { name: v.name, pct: toAmountPct(v.value, v.mode, p.precio || 0) };
            }),
            pct: part > 0 ? part / 100 : undefined,
          };
        }),
      };
    });
    return {
      language: lang,
      channels: channels,
      fixedItems: finFixedItems,
      fixedTotalFallback: 0,
      desiredProfit: finDesiredProfit,
      marketingPct: finMarketingPct / 100,
    };
  }

  function handleFinNext() {
    setFinError(null);
    if (finStage === 1) {
      if (finCanales.length === 0) {
        setFinError(
          lang === 'en'
            ? 'Add at least one income channel (e.g. Ice Cream Shop).'
            : 'Agrega al menos un canal de ingreso (ej. Nevería).'
        );
        return;
      }
      if (!finCanales.some(function (c) { return c.nombre.trim() !== ''; })) {
        setFinError(
          lang === 'en'
            ? 'Write the name of at least one income channel.'
            : 'Escribe el nombre de al menos un canal de ingreso.'
        );
        return;
      }
      if (finIngresosTotal <= 0) {
        setFinError(
          lang === 'en'
            ? 'Enter a unit price in at least one product.'
            : 'Ingresa un precio unitario en al menos un producto.'
        );
        return;
      }
      if (finFixedItems.length === 0) {
        setFinError(
          lang === 'en'
            ? 'Add at least one fixed expense (e.g. Rent, Utilities).'
            : 'Agrega al menos un gasto fijo (ej. Renta, Luz).'
        );
        return;
      }
      if (finTotalVarPct >= 1) {
        setFinError(
          lang === 'en'
            ? 'Your variable costs already add up to 100% or more of your revenue. Adjust the numbers before continuing.'
            : 'Tus costos variables ya suman 100% o más de tus ingresos. Ajusta los montos antes de continuar.'
        );
        return;
      }
      setFinStage(2);
      const hasAnyParticipation = finCanales.some(function (c) {
        return c.productos.some(function (p) { return (p.participacion || 0) > 0; });
      });
      if (!hasAnyParticipation && finIngresosTotal > 0) {
        setFinCanales(function (prev) {
          return prev.map(function (c) {
            return {
              ...c,
              productos: c.productos.map(function (p) {
                const income = productoIngresos(p);
                return { ...p, participacion: Math.round((income / finIngresosTotal) * 100) };
              }),
            };
          });
        });
      }
      return;
    }
    if (finStage === 2) {
      const partSum = finCanales.reduce(function (s, c) {
        return s + c.productos.reduce(function (s2, p) { return s2 + (p.participacion || 0); }, 0);
      }, 0);
      if (partSum <= 0) {
        setFinError(
          lang === 'en'
            ? 'Enter a percentage greater than zero for at least one product.'
            : 'Ingresa un porcentaje mayor a cero en al menos un producto.'
        );
        return;
      }
      setFinStage(3);
      return;
    }
    if (finStage === 3) {
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
  async function handleFinGenerate() {
    setFinSending(true);
    setFinError(null);
    try {
      const goalsInput = buildGoalsInput();
      try {
        const resultForSave = computeFinancialGoals(goalsInput);
        const savedEntry: FinGoalsSaved = {
          id: finEditingId ?? String(Date.now()),
          input: goalsInput,
          result: resultForSave,
          savedAt: new Date().toISOString(),
          form: {
            canales: finCanales.map(function (c) {
              return {
                nombre: c.nombre,
                participacion: c.participacion,
                productos: c.productos.map(function (p) {
                  return {
                    nombre: p.nombre,
                    unidades: p.unidades,
                    unidadMedida: p.unidadMedida,
                    precio: p.precio,
                    participacion: p.participacion,
                    gastosVariables: p.gastosVariables.map(function (v) { return { name: v.name, value: v.value, mode: v.mode }; }),
                  };
                }),
              };
            }),
            fixedItems: finFixedItems.map(function (item) { return { name: item.name, amount: item.amount }; }),
            desiredProfit: finDesiredProfit,
            marketingPct: finMarketingPct,
          },
        };
        setFinHistory(function (prev) {
          const without = prev.filter(function (h) { return h.id !== savedEntry.id; });
          const next = [savedEntry, ...without].slice(0, FIN_HISTORY_MAX);
          writeFinHistory(next, uid);
          return next;
        });
      } catch (saveErr) {
        console.error(saveErr);
      }
      await downloadFinancialGoalsExcel(goalsInput);
      setFinDone(true);
    } catch (err) {
      setFinError(err instanceof Error ? err.message : (lang === 'en' ? 'Error generating file' : 'Error al generar el archivo'));
    } finally {
      setFinSending(false);
    }
  }

  const finItemizedFixedTotal =
    finFixedItems.length > 0
      ? finFixedItems.reduce(function (s, f) { return s + f.amount; }, 0)
      : 0;
  const finIngresosTotal = finCanales.reduce(function (s, c) {
    return s + c.productos.reduce(function (s2, p) { return s2 + productoIngresos(p); }, 0);
  }, 0);
  const finProductosCount = finCanales.reduce(function (s, c) { return s + c.productos.length; }, 0);
  const finPromedioPrecio = finProductosCount > 0
    ? finCanales.reduce(function (s, c) {
        return s + c.productos.reduce(function (s2, p) { return s2 + (p.precio || 0); }, 0);
      }, 0) / finProductosCount
    : 0;
  const finGastosVarPonderado = finCanales.reduce(function (s, c) {
    return s + c.productos.reduce(function (s2, p) { return s2 + productoIngresos(p) * productoVarPct(p); }, 0);
  }, 0);
  const finTotalVarPct = finIngresosTotal > 0 ? finGastosVarPonderado / finIngresosTotal : 0;
  const finStage1Invalid = finTotalVarPct >= 1;
  const finStage1Denom = 1 - finTotalVarPct;
  const finStage1BreakEven = finStage1Invalid ? null : finItemizedFixedTotal / finStage1Denom;
  const finStage1Target = finStage1Invalid ? null : (finItemizedFixedTotal + finDesiredProfit) / finStage1Denom;
  const finInvalid = finTotalVarPct >= 1;
  const finDenom = 1 - finTotalVarPct;
  const finBreakEven = finInvalid ? null : finItemizedFixedTotal / finDenom;
  const finTarget = finInvalid ? null : (finItemizedFixedTotal + finDesiredProfit) / finDenom;
  const finResultLive: FinancialGoalsResult | null =
    !finInvalid && finCanales.length > 0
      ? computeFinancialGoals(buildGoalsInput())
      : null;

  function fmtMoney(v: number): string {
    return '$' + Math.round(v).toLocaleString(undefined, { maximumFractionDigits: 0 });
  }

  return (
    <div>
      {!finActive && (
        <Button onClick={handleStartFinancialGoals} variant="outline" className="w-full">
          {lang === 'en' ? 'Define financial goals (break-even + projection)' : 'Definir objetivos financieros (punto de equilibrio + proyección)'}
        </Button>
      )}
      {finActive && (
        <Card className="p-4 space-y-3">
          {finDone ? (
            <div className="space-y-2 text-sm text-slate-800">
              <p className="font-semibold">
                {lang === 'en' ? 'Your financial goals file was downloaded.' : 'Tu archivo de metas propuestas se descargó.'}
              </p>
              <Button onClick={handleCloseFinancialGoals} variant="outline" size="sm">
                {lang === 'en' ? 'Close' : 'Cerrar'}
              </Button>
            </div>
          ) : finMenu ? (
            <div className="overflow-hidden glass-panel">
              <div className="flex items-center justify-between bg-[#32BAD0] px-4 py-3">
                <p className="text-sm font-bold uppercase tracking-wide text-white">
                  {lang === 'en' ? 'Saved financial goals' : 'Objetivos financieros guardados'}
                </p>
                <span className="rounded-full bg-white/25 px-2.5 py-0.5 text-xs font-semibold text-white">{finHistory.length}</span>
              </div>
              <div className="space-y-3 bg-white p-3">
                {finHistory.length === 0 && (
                  <p className="text-sm text-slate-500">{lang === 'en' ? 'You have no saved goals yet.' : 'Aún no tienes objetivos guardados.'}</p>
                )}
                {finHistory.map(function (entry, idx) {
                  const isLatest = idx === 0;
                  const marketingShown = entry.form?.marketingPct ?? Math.round((entry.input.marketingPct ?? 0) * 100);
                  let liveResult: FinancialGoalsResult = entry.result;
                  try {
                    liveResult = computeFinancialGoals(entry.input);
                  } catch {
                    liveResult = entry.result;
                  }
                  return (
                    <div key={entry.id} className={'glass-panel p-3 ' + (isLatest ? 'border-[#32BAD0]/60 bg-[#E1F6FA]/30' : '')}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-700">{formatFinDate(entry.savedAt, lang)}</p>
                        {isLatest && (
                          <span className="rounded-full bg-[#32BAD0] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                            {lang === 'en' ? 'Latest' : 'Último guardado'}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-slate-500">{lang === 'en' ? 'Desired profit' : 'Utilidad deseada'}</p>
                          <p className="text-base font-bold text-slate-900">{fmtMoney(entry.form?.desiredProfit ?? entry.input.desiredProfit ?? 0)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-slate-500">{lang === 'en' ? 'Break-even' : 'Punto de equilibrio'}</p>
                          <p className="text-base font-bold text-slate-900">{fmtMoney(liveResult.breakEvenWithMarketing ?? 0)}</p>
                        </div>
                      </div>
                      {(() => {
                        let channelRows: { name: string; pct: number; varPct: number }[] = [];
                        try {
                          const finCh = computeFinancialChannels(entry.input);
                          const wSum = finCh.summaries.reduce(function (s, c) { return s + c.pct; }, 0);
                          channelRows = finCh.summaries.map(function (c) {
                            return { name: c.name, pct: wSum > 0 ? c.pct / wSum : 0, varPct: c.varPct };
                          });
                        } catch {
                          channelRows = [];
                        }
                        const targetRevenue = liveResult.targetRevenueWithMarketing ?? 0;
                        const desiredProfitEntry = entry.form?.desiredProfit ?? entry.input.desiredProfit ?? 0;
                        const totalGastos = targetRevenue - desiredProfitEntry;
                        return (
                          <div className="mt-2 glass-panel p-2">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[10px] uppercase tracking-wide text-slate-500">
                                {lang === 'en' ? 'Monthly goal revenue by channel' : 'Ingreso meta mensual por canal de ingreso'}
                              </p>
                              <p className="text-xs font-bold text-slate-900">{fmtMoney(targetRevenue)}</p>
                            </div>
                            {channelRows.length === 0 ? (
                              <p className="mt-1 text-[11px] text-slate-500">—</p>
                            ) : (
                              <div className="mt-1 space-y-1">
                                {channelRows.map(function (ch, chIdx) {
                                  const chTarget = targetRevenue * ch.pct;
                                  const chVar = chTarget * ch.varPct;
                                  return (
                                    <div key={chIdx} className="flex items-start justify-between gap-2 border-b border-slate-100 py-1 text-[11px]">
                                      <div className="min-w-0">
                                        <p className="truncate font-medium text-slate-800">{ch.name || (lang === 'en' ? '(unnamed)' : '(sin nombre)')}</p>
                                        <p className="text-[10px] text-slate-500">
                                          {lang === 'en' ? 'Share' : 'Participación'}: {(ch.pct * 100).toFixed(1)}% | {lang === 'en' ? 'Expenses' : 'Gastos'}: {(ch.varPct * 100).toFixed(1)}%
                                        </p>
                                      </div>
                                      <div className="shrink-0 text-right">
                                        <p className="font-semibold text-slate-800">{fmtMoney(chTarget)}</p>
                                        <p className="text-[10px] text-slate-500">
                                          {lang === 'en' ? 'Expenses' : 'Gastos'}: {fmtMoney(chVar)}
                                        </p>
                                      </div>
                                    </div>
                                  );
                                })}
                                <div className="flex items-center justify-between pt-1 text-[11px]">
                                  <p className="font-semibold text-slate-800">{lang === 'en' ? 'Total expenses (fixed + variable + marketing)' : 'Gastos totales (fijos + variables + mercadotecnia)'}</p>
                                  <p className="font-semibold text-slate-800">{fmtMoney(totalGastos)}</p>
                                </div>
                              </div>
                            )}
                            {(() => {
                              const finChP = computeFinancialChannels(entry.input);
                              const prodRows = finChP.products.map(function (p) {
                                const pTarget = targetRevenue * p.pct;
                                const src = entry.input.channels.find(function (c) { return c.name === p.channel; })?.products?.find(function (pr) { return pr.name === p.name; });
                                const unitPrice = src?.unitPrice ?? 0;
                                return { name: p.name, channel: p.channel, income: p.income, target: pTarget, units: unitPrice > 0 ? Math.ceil(pTarget / unitPrice) : null };
                              });
                              if (prodRows.length === 0) return null;
                              return (
                                <div className="mt-2 space-y-1 border-t border-slate-100 pt-1">
                                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                                    {lang === 'en' ? 'Goal per product/service and required units' : 'Meta por producto/servicio y unidades requeridas'}
                                  </p>
                                  {prodRows.map(function (pr, prIdx) {
                                    return (
                                      <div key={prIdx} className="flex items-start justify-between gap-2 text-[11px]">
                                        <div className="min-w-0">
                                          <p className="truncate font-medium text-slate-800">{pr.name || (lang === 'en' ? '(unnamed product)' : '(producto sin nombre)')}</p>
                                          <p className="text-[10px] text-slate-500">
                                            {pr.channel} | {lang === 'en' ? 'Goal' : 'Meta'}: {fmtMoney(pr.target)}
                                          </p>
                                        </div>
                                        <div className="shrink-0 text-right">
                                          <p className="font-semibold text-slate-800">
                                            {pr.units !== null
                                              ? Math.round(pr.units).toLocaleString(undefined, { maximumFractionDigits: 0 }) + ' ' + (lang === 'en' ? 'units' : 'uds.')
                                              : '—'}
                                          </p>
                                          <p className="text-[10px] text-slate-500">{lang === 'en' ? 'Revenue' : 'Ingresos'}: {fmtMoney(pr.income)}</p>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })()}
                      <p className="mt-1.5 text-[11px] text-slate-500">
                        {lang === 'en' ? 'Marketing investment' : 'Inversión en mercadotecnia'}: {marketingShown}%
                      </p>
                      <div className="mt-2.5 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={function () { handleEditSaved(entry); }}
                          className="rounded-md bg-[#32BAD0] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#2AA6BB]"
                        >
                          {lang === 'en' ? 'Edit' : 'Editar'}
                        </button>
                        <button
                          type="button"
                          onClick={function () { handleDeleteSaved(entry.id); }}
                          className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50"
                        >
                          {lang === 'en' ? 'Delete' : 'Eliminar'}
                        </button>
                      </div>
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={handleNewFinGoals}
                  className="w-full rounded-md bg-[#32BAD0] px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2AA6BB]"
                >
                  {lang === 'en' ? '+ Add new financial goals' : '+ Añadir nuevos objetivos financieros'}
                </button>
                <button
                  type="button"
                  onClick={handleCloseFinancialGoals}
                  className="w-full text-center text-xs font-medium text-slate-500 underline underline-offset-2 hover:text-slate-700"
                >
                  {lang === 'en' ? 'Close' : 'Cerrar'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: String((Math.min(finStage, 3) / 3) * 100) + '%' }} />
              </div>
              <p className="text-xs text-slate-500">
                {lang === 'en' ? 'Stage' : 'Etapa'} {Math.min(finStage, 3)} {lang === 'en' ? 'of 3' : 'de 3'}
              </p>
              {finError && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 border border-red-200">
                  {finError}
                </div>
              )}
              {!finReviewing && finStage === 1 && (
                <div className="space-y-3 text-sm text-slate-800">
                  <p className="font-semibold">{lang === 'en' ? 'Stage 1: Your income channels, products and expenses' : 'Etapa 1: Tus canales de ingreso, productos y gastos'}</p>
                  <datalist id="fin-unidad-medida-list">
                    <option value={lang === 'en' ? 'pieces' : 'piezas'} />
                    <option value="horas" />
                    <option value="litros" />
                    <option value="kilos" />
                    <option value="metros" />
                    <option value={lang === 'en' ? 'boxes' : 'cajas'} />
                    <option value={lang === 'en' ? 'dozens' : 'docenas'} />
                    <option value={lang === 'en' ? 'services' : 'servicios'} />
                  </datalist>
                  {finCanales.map(function (c, ci) {
                    const ciIngresos = c.productos.reduce(function (s, p) { return s + productoIngresos(p); }, 0);
                    const ciVar = c.productos.reduce(function (s, p) { return s + productoIngresos(p) * productoVarPct(p); }, 0);
                    const ciVarPct = ciIngresos > 0 ? (ciVar / ciIngresos) * 100 : 0;
                    const ciPct = finIngresosTotal > 0 ? (ciIngresos / finIngresosTotal) * 100 : 0;
                    const ciPromedio = c.productos.length > 0
                      ? c.productos.reduce(function (s2, p) { return s2 + (p.precio || 0); }, 0) / c.productos.length
                      : 0;
                    return (
                      <div key={ci} className="space-y-2 glass-panel p-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={c.nombre}
                            onChange={function (e) { updateCanal(ci, { nombre: e.target.value }); }}
                            placeholder={lang === 'en' ? 'Income channel (e.g. Ice Cream Shop)' : 'Canal de ingreso (ej. Nevería)'}
                            className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <button type="button" onClick={function () { removeCanal(ci); }} className="text-red-500 hover:text-red-700 text-sm px-2">×</button>
                        </div>
                        {c.productos.map(function (p, pi) {
                          const pIngresos = productoIngresos(p);
                          const pVarPct = productoVarPct(p);
                          return (
                            <div key={pi} className="space-y-2 glass-panel p-2.5">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                  {lang === 'en' ? 'Product/Service' : 'Producto/Servicio'}
                                </span>
                                <input
                                  type="text"
                                  value={p.nombre}
                                  onChange={function (e) { updateProducto(ci, pi, { nombre: e.target.value }); }}
                                  placeholder={lang === 'en' ? 'e.g. Ice cream' : 'ej. Helado'}
                                  className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <button type="button" onClick={function () { removeProducto(ci, pi); }} className="text-red-500 hover:text-red-700 text-sm px-2">×</button>
                              </div>
                              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                <label className="block space-y-1">
                                  <span className="text-[11px] text-slate-600">{lang === 'en' ? 'Unit price' : 'Precio Unitario'}</span>
                                  <input
                                    type="number"
                                    inputMode="decimal"
                                    min="0"
                                    step="0.01"
                                    value={p.precio || ''}
                                    onChange={function (e) { updateProducto(ci, pi, { precio: Number(e.target.value) }); }}
                                    placeholder="50"
                                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  />
                                </label>
                                <label className="block space-y-1">
                                  <span className="text-[11px] text-slate-600">{lang === 'en' ? 'Measure' : 'Medida'}</span>
                                  <input
                                    type="text"
                                    list="fin-unidad-medida-list"
                                    value={p.unidadMedida}
                                    onChange={function (e) { updateProducto(ci, pi, { unidadMedida: e.target.value }); }}
                                    placeholder={lang === 'en' ? 'pieces, hours, liters...' : 'piezas, horas, litros...'}
                                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  />
                                </label>
                              </div>
                              <div className="space-y-1.5">
                                <p className="text-[11px] text-slate-600">
                                  {lang === 'en'
                                    ? "Variable expenses (expenses needed to make and deliver the product/service). If you don't sell, you don't have these."
                                    : 'Gastos variables (los gastos relacionados para realizar y entregar el producto/servicio). Si no vendes no tienes estos gastos.'}
                                </p>
                                {p.gastosVariables.map(function (v, vi) {
                                  return (
                                    <div key={vi} className="flex gap-2 items-center">
                                      <input
                                        type="text"
                                        value={v.name}
                                        onChange={function (e) { updateGastoVar(ci, pi, vi, { name: e.target.value }); }}
                                        placeholder={lang === 'en' ? 'Name (e.g. Supplies)' : 'Nombre (ej. Insumos)'}
                                        className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      />
                                      <input
                                        type="number"
                                        value={v.value || ''}
                                        onChange={function (e) { updateGastoVar(ci, pi, vi, { value: Number(e.target.value) }); }}
                                        className="w-24 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      />
                                      <select
                                        value={v.mode}
                                        onChange={function (e) { updateGastoVar(ci, pi, vi, { mode: e.target.value as '$' | '%' }); }}
                                        className="rounded-md border border-slate-300 bg-white px-2 py-2 text-sm"
                                      >
                                        <option value="$">$</option>
                                        <option value="%">%</option>
                                      </select>
                                      <button type="button" onClick={function () { removeGastoVar(ci, pi, vi); }} className="text-red-500 hover:text-red-700 text-sm px-2">×</button>
                                    </div>
                                  );
                                })}
                                <button
                                  type="button"
                                  onClick={function () { addGastoVar(ci, pi); }}
                                  className="rounded-md border border-slate-300 bg-[#ffffff] px-3 py-1.5 text-xs font-semibold text-[#0F172A] transition-colors hover:bg-slate-100"
                                >
                                  {lang === 'en' ? '+ Add variable expense' : '+ Agregar gasto variable'}
                                </button>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="flex-1 rounded-md bg-slate-50 border border-slate-200 px-3 py-1.5 text-xs text-slate-600">
                                  {lang === 'en' ? 'Revenue: ' : 'Ingresos: '}
                                  <span className="font-semibold text-slate-800">{fmtMoney(pIngresos)}</span>
                                  <span className="mx-1.5">|</span>
                                  {lang === 'en' ? '% Variable: ' : '% Gastos variables: '}
                                  <span className="font-semibold text-slate-800">{(pVarPct * 100).toFixed(1)}%</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={function () { duplicarProducto(ci, pi); }}
                                  className="rounded-md border border-slate-300 bg-[#ffffff] px-3 py-1.5 text-xs font-semibold text-[#0F172A] transition-colors hover:bg-slate-100"
                                >
                                  {lang === 'en' ? 'Duplicate product' : 'Duplicar producto'}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                        <button
                          type="button"
                          onClick={function () { addProducto(ci); }}
                          className="rounded-md border border-slate-300 bg-[#ffffff] px-3 py-1.5 text-xs font-semibold text-[#0F172A] transition-colors hover:bg-slate-100"
                        >
                          {lang === 'en' ? '+ Add product/service' : '+ Agregar Producto/Servicio'}
                        </button>
                        <div className="rounded-md bg-[#E1F6FA] border border-[#32BAD0]/30 px-3 py-1.5 text-xs text-[#0F172A]">
                          {lang === 'en' ? 'Average price of Product(s)/Service(s): ' : 'Precio promedio de Producto(s)/Servicio(s): '}
                          <span className="font-semibold">{fmtMoney(ciPromedio)}</span>
                          <span className="mx-1.5">|</span>
                          {lang === 'en' ? '% of total income: ' : '% del ingreso total: '}
                          <span className="font-semibold">{ciPct.toFixed(1)}%</span>
                          <span className="mx-1.5">|</span>
                          {lang === 'en' ? 'Channel % variable: ' : '% gastos variables del canal: '}
                          <span className="font-semibold">{ciVarPct.toFixed(1)}%</span>
                        </div>
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    onClick={addCanal}
                    className="w-full rounded-md border-2 border-dashed border-[#32BAD0] bg-[#ffffff] px-3 py-2 text-sm font-semibold text-[#0F172A] transition-colors hover:bg-[#E1F6FA]/60"
                  >
                    {lang === 'en' ? '+ Add income channel' : '+ Agregar Canal de Ingreso'}
                  </button>
                  {finCanales.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-slate-600">
                        {lang === 'en' ? 'Break down your fixed expenses' : 'Desglosa tus gastos fijos'}
                        <span className="text-slate-400">
                          {' '}
                          {lang === 'en' ? '(e.g. Rent, Utilities, Payroll, Advertising, Internet)' : '(ej. renta, luz, nómina, publicidad, internet)'}
                        </span>
                      </p>
                      {finFixedItems.map(function (item, i) {
                        return (
                          <div key={i} className="flex gap-2 items-center">
                            <input
                              type="text"
                              value={item.name}
                              onChange={function (e) { updateFixedItem(i, { name: e.target.value }); }}
                              placeholder={lang === 'en' ? 'Name (e.g. Rent)' : 'Nombre (ej. Renta)'}
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
                      <button
                        type="button"
                        onClick={addFixedItem}
                        className="rounded-md border border-slate-300 bg-[#ffffff] px-3 py-1.5 text-xs font-semibold text-[#0F172A] transition-colors hover:bg-slate-100"
                      >
                        {lang === 'en' ? '+ Add fixed expense' : '+ Agregar gastos fijos'}
                      </button>
                    </div>
                  )}
                  <label className="block space-y-1">
                    <span className="text-xs text-slate-600">{lang === 'en' ? 'Desired monthly profit' : 'Utilidad mensual deseada'}</span>
                    <input
                      type="number"
                      value={finDesiredProfit || ''}
                      onChange={function (e) { setFinDesiredProfit(Number(e.target.value)); }}
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </label>
                  <div className="glass-panel p-3 space-y-1 text-slate-900">
                    <p>{lang === 'en' ? 'Average income per Product(s)/Service(s)' : 'Ingreso promedio por Producto(s)/Servicio(s)'}: {fmtMoney(finPromedioPrecio)}</p>
                    <p>{lang === 'en' ? 'Total fixed expenses' : 'Total gastos fijos'}: {finItemizedFixedTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                    <p>{lang === 'en' ? '% Variable costs (weighted)' : '% Costos variables (ponderado)'}: {(finTotalVarPct * 100).toFixed(1)}%</p>
                    {finStage1Invalid ? (
                      <p className="text-red-600 font-medium">
                        {lang === 'en'
                          ? 'Your variable costs already reach 100% or more of your revenue. Fix the numbers above before continuing.'
                          : 'Tus costos variables ya llegan a 100% o más de tus ingresos. Corrige los montos antes de continuar.'}
                      </p>
                    ) : (
                      <>
                        <p>{lang === 'en' ? 'Break-even point' : 'Punto de equilibrio'}: {finStage1BreakEven !== null ? fmtMoney(finStage1BreakEven) : '—'}</p>
                        <p>{lang === 'en' ? 'Revenue needed for your profit goal' : 'Ingreso necesario para tu meta de utilidad'}: {finStage1Target !== null ? fmtMoney(finStage1Target) : '—'}</p>
                      </>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleFinNext} size="sm">{lang === 'en' ? 'Continue' : 'Continuar'}</Button>
                  </div>
                </div>
              )}
              {!finReviewing && finStage === 2 && (
                <div className="space-y-3 text-sm text-slate-800">
                  <p className="font-semibold">{lang === 'en' ? 'Stage 2: Revenue participation per product' : 'Etapa 2: % de participación por producto'}</p>
                  <p className="text-xs text-slate-500">
                    {lang === 'en'
                      ? 'Enter the % participation of each product over your total monthly revenue. Each channel share is the sum of its products. This weighting adjusts your revenue and variable costs.'
                      : 'Ingresa el % de participación de cada producto sobre tus ingresos totales mensuales. La participación de cada canal es la suma de sus productos. Esta ponderación ajusta tus ingresos y % de gastos variables.'}
                  </p>
                  {finCanales.map(function (c, ci) {
                    const ciIngresos = c.productos.reduce(function (s, p) { return s + productoIngresos(p); }, 0);
                    const ciVar = c.productos.reduce(function (s, p) { return s + productoIngresos(p) * productoVarPct(p); }, 0);
                    const ciVarPct = ciIngresos > 0 ? (ciVar / ciIngresos) * 100 : 0;
                    const ciPart = c.productos.reduce(function (s, p) { return s + (p.participacion || 0); }, 0);
                    return (
                      <div key={ci} className="space-y-2 glass-panel p-3">
                        <p className="font-semibold text-slate-800">{c.nombre || (lang === 'en' ? '(unnamed)' : '(sin nombre)')}</p>
                        {c.productos.map(function (p, pi) {
                          const pIngresos = productoIngresos(p);
                          return (
                            <div key={pi} className="flex items-center gap-2 glass-panel px-3 py-2">
                              <span className="flex-1 truncate font-medium">{p.nombre || (lang === 'en' ? '(unnamed product)' : '(producto sin nombre)')}</span>
                              <span className="text-xs text-slate-500">{lang === 'en' ? 'Revenue' : 'Ingresos'}: <span className="font-semibold text-slate-800">{fmtMoney(pIngresos)}</span></span>
                              <input
                                type="number"
                                value={p.participacion || ''}
                                onChange={function (e) { updateParticipacion(ci, pi, Number(e.target.value)); }}
                                className="w-20 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              <span className="text-slate-500">%</span>
                            </div>
                          );
                        })}
                        <div className="rounded-md bg-[#E1F6FA] border border-[#32BAD0]/30 px-3 py-1.5 text-xs text-[#0F172A]">
                          {lang === 'en' ? 'Channel participation: ' : 'Participación del canal: '}
                          <span className="font-semibold">{ciPart.toFixed(1)}%</span>
                          <span className="mx-1.5">|</span>
                          {lang === 'en' ? 'Channel % variable: ' : '% gastos variables del canal: '}
                          <span className="font-semibold">{ciVarPct.toFixed(1)}%</span>
                        </div>
                      </div>
                    );
                  })}
                  {(() => {
                    const partSum = finCanales.reduce(function (s, c) {
                      return s + c.productos.reduce(function (s2, p) { return s2 + (p.participacion || 0); }, 0);
                    }, 0);
                    return Math.abs(partSum - 100) > 2 && partSum > 0 ? (
                      <p className="text-xs text-slate-500">
                        {lang === 'en'
                          ? "Your percentages didn't add up to 100%, so we'll adjust them proportionally."
                          : 'Tus porcentajes no suman 100%, los ajustaremos proporcionalmente.'}
                      </p>
                    ) : null;
                  })()}
                  <div className="flex gap-2">
                    <Button onClick={handleFinBack} variant="outline" size="sm">{lang === 'en' ? 'Back' : 'Atrás'}</Button>
                    <Button onClick={handleFinNext} size="sm">{lang === 'en' ? 'Continue' : 'Continuar'}</Button>
                  </div>
                </div>
              )}
              {!finReviewing && finStage === 3 && (
                <div className="space-y-3 text-sm text-slate-800">
                  <p className="font-semibold">{lang === 'en' ? 'Stage 3: Marketing investment' : 'Etapa 3: Inversión en mercadotecnia'}</p>
                  <label className="block space-y-1">
                    <span className="text-xs text-slate-600">{lang === 'en' ? '% of revenue invested in marketing' : '% de ingresos invertido en mercadotecnia'}</span>
                    <input
                      type="number"
                      value={finMarketingPct || ''}
                      onChange={function (e) { setFinMarketingPct(Number(e.target.value)); }}
                      placeholder="10"
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </label>
                  {finResultLive && (
                    <div className="glass-panel p-3 space-y-1 text-slate-900">
                      <p>{lang === 'en' ? 'Growth you can expect with that investment' : 'Crecimiento esperado con esa inversión'}: {(finResultLive.expectedGrowthRate * 100).toFixed(1)}% {lang === 'en' ? 'monthly' : 'mensual'}</p>
                      <p>{lang === 'en' ? 'Growth needed to reach your goal in 12 months' : 'Crecimiento necesario para llegar a tu meta en 12 meses'}: {(finResultLive.requiredGrowthRate * 100).toFixed(1)}% {lang === 'en' ? 'monthly' : 'mensual'}</p>
                      {finResultLive.isSufficient ? (
                        <p className="text-green-700 font-medium">
                          {lang === 'en' ? 'Your planned investment is enough to reach your goal.' : 'Tu inversión planeada es suficiente para llegar a tu meta.'}
                        </p>
                      ) : (
                        <p className="text-amber-700 font-medium">
                          {finResultLive.recommendedMarketingPct !== null
                            ? (lang === 'en'
                                ? 'That investment is not enough. We recommend investing at least ' + (finResultLive.recommendedMarketingPct * 100).toFixed(0) + '% of your revenue (about ' + (finResultLive.recommendedMarketingAmount ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 }) + ' at the start).'
                                : 'Con esa inversión no alcanzas tu meta. Te recomendamos invertir al menos ' + (finResultLive.recommendedMarketingPct * 100).toFixed(0) + '% de tus ingresos (aproximadamente ' + (finResultLive.recommendedMarketingAmount ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 }) + ' al inicio).')
                            : (lang === 'en'
                                ? 'Even a high marketing investment would not reach this goal in 12 months. Consider a longer timeline or a lower profit goal.'
                                : 'Ni siquiera con una inversión alta se alcanza esta meta en 12 meses. Considera un plazo más largo o una meta de utilidad menor.')}
                        </p>
                      )}
                    </div>
                  )}
                  {(() => {
                    const targetRevenue = finResultLive?.targetRevenueWithMarketing ?? 0;
                    if (targetRevenue <= 0) return null;
                    const finCh = computeFinancialChannels(buildGoalsInput());
                    const chRows = finCh.summaries.map(function (c) { return { name: c.name, pct: c.pct, varPct: c.varPct }; });
                    const prodRows = finCh.products.map(function (p) {
                      const pTarget = targetRevenue * p.pct;
                      const src = finCanales.find(function (c) { return c.nombre === p.channel; })?.productos.find(function (pr) { return pr.nombre === p.name; });
                      const unitPrice = src?.precio ?? 0;
                      return { name: p.name, channel: p.channel, income: p.income, target: pTarget, units: unitPrice > 0 ? Math.ceil(pTarget / unitPrice) : null };
                    });
                    return (
                      <div className="glass-panel p-3 space-y-2 text-slate-900">
                        <p className="font-semibold">
                          {lang === 'en' ? 'Your financial goals (before downloading)' : 'Objetivos financieros (antes de descargar)'}
                        </p>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs text-slate-600">{lang === 'en' ? 'Goal revenue' : 'Ingreso meta'}</p>
                          <p className="text-sm font-bold">{fmtMoney(targetRevenue)}</p>
                        </div>
                        {chRows.map(function (ch, chIdx) {
                          return (
                            <div key={'ch' + chIdx} className="flex items-start justify-between gap-2 border-b border-slate-100 py-1 text-xs">
                              <div className="min-w-0">
                                <p className="truncate font-medium">{ch.name || (lang === 'en' ? '(unnamed)' : '(sin nombre)')}</p>
                                <p className="text-[10px] text-slate-500">
                                  {lang === 'en' ? 'Share' : 'Participación'}: {(ch.pct * 100).toFixed(1)}% | {lang === 'en' ? 'Expenses' : 'Gastos'}: {(ch.varPct * 100).toFixed(1)}%
                                </p>
                              </div>
                              <p className="shrink-0 font-semibold">{fmtMoney(targetRevenue * ch.pct)}</p>
                            </div>
                          );
                        })}
                        {prodRows.length > 0 && (
                          <div className="space-y-1 border-t border-slate-200 pt-1">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-600">
                              {lang === 'en' ? 'Per product/service: revenue and units to reach the goal' : 'Por producto/servicio: ingresos y unidades para llegar a la meta'}
                            </p>
                            {prodRows.map(function (pr, prIdx) {
                              return (
                                <div key={'pr' + prIdx} className="flex items-start justify-between gap-2 text-[11px]">
                                  <div className="min-w-0">
                                    <p className="truncate font-medium">{pr.name || (lang === 'en' ? '(unnamed product)' : '(producto sin nombre)')}</p>
                                    <p className="text-[10px] text-slate-500">
                                      {lang === 'en' ? 'Revenue' : 'Ingresos'}: {fmtMoney(pr.income)} | {lang === 'en' ? 'Goal' : 'Meta'}: {fmtMoney(pr.target)}
                                    </p>
                                  </div>
                                  <p className="shrink-0 font-semibold">
                                    {pr.units !== null
                                      ? Math.round(pr.units).toLocaleString(undefined, { maximumFractionDigits: 0 }) + ' ' + (lang === 'en' ? 'units' : 'uds.')
                                      : '—'}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  <div className="flex gap-2">
                    <Button onClick={handleFinBack} variant="outline" size="sm">{lang === 'en' ? 'Back' : 'Atrás'}</Button>
                    <Button onClick={handleFinNext} size="sm">{lang === 'en' ? 'Continue' : 'Continuar'}</Button>
                  </div>
                </div>
              )}
              {finReviewing && (
                <div className="space-y-2 text-sm text-slate-800">
                  <p className="font-semibold">{lang === 'en' ? 'Before you download...' : 'Antes de descargar...'}</p>
                  <p>
                    {lang === 'en'
                      ? 'Check that you are not missing any income channel, product and/or service. You can still go back and edit any field.'
                      : 'Revisa si no tienes algún canal de ingreso, producto y/o servicio adicional. Todavía puedes regresar y editar cualquier campo'}
                  </p>
                  <div className="flex gap-2">
                    <Button onClick={handleFinBack} variant="outline" size="sm">{lang === 'en' ? 'Back' : 'Atrás'}</Button>
                    <Button onClick={handleFinGenerate} disabled={finSending} size="sm">
                      {finSending ? (lang === 'en' ? 'Generating...' : 'Generando...') : (lang === 'en' ? 'Generate file' : 'Generar archivo')}
                    </Button>
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={handleCloseFinancialGoals}
                className="text-xs font-medium text-slate-500 underline underline-offset-2 hover:text-slate-700"
              >
                {lang === 'en' ? 'Cancel' : 'Cancelar'}
              </button>
            </>
          )}
        </Card>
      )}
    </div>
  );
}

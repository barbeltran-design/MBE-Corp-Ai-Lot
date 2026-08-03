'use client';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { downloadFinancialGoalsExcel, computeFinancialGoals } from '@/lib/deliverables';
import type { FinancialGoalsInput, FinancialGoalsResult } from '@/lib/deliverables';

type FinLang = 'es' | 'en';

function toAmountPct(value: number, mode: '$' | '%', unitPrice: number): number {
  if (mode === '%') return value / 100;
  return unitPrice > 0 ? value / unitPrice : 0;
}

export default function FinancialGoalsBuilder({ lang }: { lang: FinLang }) {
  const [finActive, setFinActive] = React.useState(false);
  const [finStage, setFinStage] = React.useState(1);
  const [finReviewing, setFinReviewing] = React.useState(false);
  const [finSending, setFinSending] = React.useState(false);
  const [finError, setFinError] = React.useState<string | null>(null);
  const [finUnitPrice, setFinUnitPrice] = React.useState(0);
  const [finDesiredProfit, setFinDesiredProfit] = React.useState(0);
  const [finFixedItems, setFinFixedItems] = React.useState<{ name: string; amount: number }[]>([]);
  const [finVarItems, setFinVarItems] = React.useState<{ name: string; value: number; mode: '$' | '%' }[]>([]);
  const [finChannels, setFinChannels] = React.useState<{ name: string; pct: number }[]>([]);
  const [finMarketingPct, setFinMarketingPct] = React.useState(0);
  const [finDone, setFinDone] = React.useState(false);

  function resetFin() {
    setFinStage(1);
    setFinReviewing(false);
    setFinSending(false);
    setFinError(null);
    setFinUnitPrice(0);
    setFinDesiredProfit(0);
    setFinFixedItems([]);
    setFinVarItems([]);
    setFinChannels([]);
    setFinMarketingPct(0);
    setFinDone(false);
  }

  function handleStartFinancialGoals() {
    resetFin();
    setFinActive(true);
  }
  function handleCloseFinancialGoals() {
    resetFin();
    setFinActive(false);
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
        setFinError(lang === 'en' ? 'Enter a sale price greater than zero.' : 'Ingresa un precio de venta mayor a cero.');
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
            ? 'Your variable costs already add up to 100% or more of your sale price. Adjust the numbers before continuing.'
            : 'Tus costos variables ya suman 100% o más de tu precio de venta. Ajusta los montos antes de continuar.'
        );
        return;
      }
      setFinStage(2);
      return;
    }
    if (finStage === 2) {
      if (finChannels.length === 0) {
        setFinError(
          lang === 'en'
            ? 'Add at least one revenue channel before continuing.'
            : 'Agrega al menos un canal de ingreso antes de continuar.'
        );
        return;
      }
      const sum = finChannels.reduce(function (s, c) { return s + c.pct; }, 0);
      if (sum <= 0) {
        setFinError(
          lang === 'en'
            ? 'Enter a percentage greater than zero for at least one channel.'
            : 'Ingresa un porcentaje mayor a cero en al menos un canal.'
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
  function handleFinGenerate() {
    setFinSending(true);
    setFinError(null);
    try {
      const materialsPct = 0;
      const laborPct = 0;
      const otherVarPct = 0;
      const varItemsForExcel = finVarItems.map(function (v) {
        return { name: v.name, pct: toAmountPct(v.value, v.mode, finUnitPrice) };
      });
      const channelPctSum = finChannels.reduce(function (s, c) { return s + c.pct; }, 0);
      const normalizedChannels =
        channelPctSum > 0
          ? finChannels.map(function (c) { return { name: c.name, pct: c.pct / channelPctSum }; })
          : finChannels.map(function (c) { return { name: c.name, pct: 0 }; });
      const goalsInput: FinancialGoalsInput = {
        language: lang,
        unitPrice: finUnitPrice,
        materialsPct: materialsPct,
        laborPct: laborPct,
        otherVarPct: otherVarPct,
        fixedItems: finFixedItems,
        fixedTotalFallback: 0,
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
      setFinError(err instanceof Error ? err.message : (lang === 'en' ? 'Error generating file' : 'Error al generar el archivo'));
    } finally {
      setFinSending(false);
    }
  }

  const finItemizedFixedTotal =
    finFixedItems.length > 0
      ? finFixedItems.reduce(function (s, f) { return s + f.amount; }, 0)
      : 0;
  const finTotalVarPct = finVarItems.reduce(function (s, v) { return s + toAmountPct(v.value, v.mode, finUnitPrice); }, 0);
  const finStage1Invalid = finTotalVarPct >= 1;
  const finStage1Denom = 1 - finTotalVarPct;
  const finStage1BreakEven = finStage1Invalid ? null : finItemizedFixedTotal / finStage1Denom;
  const finStage1Target = finStage1Invalid ? null : (finItemizedFixedTotal + finDesiredProfit) / finStage1Denom;
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
          language: lang,
          unitPrice: finUnitPrice,
          materialsPct: 0,
          laborPct: 0,
          otherVarPct: 0,
          fixedItems: finFixedItems,
          fixedTotalFallback: 0,
          varItems: finVarItems.map(function (v) { return { name: v.name, pct: toAmountPct(v.value, v.mode, finUnitPrice) }; }),
          desiredProfit: finDesiredProfit,
          channels: finChannelsNormalized,
          marketingPct: finMarketingPct / 100,
        })
      : null;

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
                  <p className="font-semibold">{lang === 'en' ? 'Stage 1: Your product or service and your expenses' : 'Etapa 1: Tu producto o servicio y tus gastos'}</p>
                  <label className="block space-y-1">
                    <span className="text-xs text-slate-600">{lang === 'en' ? 'Sale price per unit' : 'Precio de venta por unidad'}</span>
                    <input
                      type="number"
                      value={finUnitPrice || ''}
                      onChange={function (e) { setFinUnitPrice(Number(e.target.value)); }}
                      placeholder="500"
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </label>
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
                    <button type="button" onClick={addFixedItem} className="text-xs font-medium text-blue-600 hover:text-blue-800 underline underline-offset-2">
                      {lang === 'en' ? '+ Add fixed expense' : '+ Agregar gasto fijo'}
                    </button>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-slate-600">
                      {lang === 'en' ? 'Break down your variable expenses' : 'Desglosa tus gastos variables'}
                      <span className="text-slate-400">
                        {' '}
                        {lang === 'en' ? '(e.g. Supplies, Provider, Commissions, Taxes)' : '(ej. insumos, proveedor, comisiones, impuestos)'}
                      </span>
                    </p>
                    {finVarItems.map(function (item, i) {
                      return (
                        <div key={i} className="flex gap-2 items-center">
                          <input
                            type="text"
                            value={item.name}
                            onChange={function (e) { updateVarItem(i, { name: e.target.value }); }}
                            placeholder={lang === 'en' ? 'Name (e.g. Supplies)' : 'Nombre (ej. Insumos)'}
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
                      {lang === 'en' ? '+ Add variable expense' : '+ Agregar gasto variable'}
                    </button>
                  </div>
                  <label className="block space-y-1">
                    <span className="text-xs text-slate-600">{lang === 'en' ? 'Desired monthly profit' : 'Utilidad mensual deseada'}</span>
                    <input
                      type="number"
                      value={finDesiredProfit || ''}
                      onChange={function (e) { setFinDesiredProfit(Number(e.target.value)); }}
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </label>
                  <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-1 text-slate-900">
                    <p>{lang === 'en' ? 'Total fixed expenses' : 'Total gastos fijos'}: {finItemizedFixedTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                    <p>{lang === 'en' ? '% Variable costs' : '% Costos variables'}: {(finTotalVarPct * 100).toFixed(1)}%</p>
                    {finStage1Invalid ? (
                      <p className="text-red-600 font-medium">
                        {lang === 'en'
                          ? 'Your variable costs already reach 100% or more of your price. Fix the numbers above before continuing.'
                          : 'Tus costos variables ya llegan a 100% o más de tu precio. Corrige los montos antes de continuar.'}
                      </p>
                    ) : (
                      <>
                        <p>{lang === 'en' ? 'Break-even point' : 'Punto de equilibrio'}: {finStage1BreakEven !== null ? finStage1BreakEven.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}</p>
                        <p>{lang === 'en' ? 'Revenue needed for your profit goal' : 'Ingreso necesario para tu meta de utilidad'}: {finStage1Target !== null ? finStage1Target.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}</p>
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
                  <p className="font-semibold">{lang === 'en' ? 'Stage 2: Your revenue channels' : 'Etapa 2: Tus canales de ingreso'}</p>
                  {finChannels.map(function (c, i) {
                    return (
                      <div key={i} className="flex gap-2 items-center">
                        <input
                          type="text"
                          value={c.name}
                          onChange={function (e) { updateChannel(i, { name: e.target.value }); }}
                          placeholder={lang === 'en' ? 'Name (e.g. Online sales)' : 'Nombre (ej. Ventas en línea)'}
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
                    {lang === 'en' ? '+ Add channel' : '+ Agregar canal'}
                  </button>
                  {finChannels.length > 0 && (
                    <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-1 text-slate-900">
                      {finChannelsNormalized.map(function (c, i) {
                        return <p key={i}>{c.name || (lang === 'en' ? '(unnamed)' : '(sin nombre)')}: {(c.pct * 100).toFixed(1)}%</p>;
                      })}
                      {Math.abs(finChannelPctSum - 100) > 2 && (
                        <p className="text-xs text-slate-500">
                          {lang === 'en'
                            ? "Your percentages didn't add up to 100%, so we'll adjust them proportionally."
                            : 'Tus porcentajes no suman 100%, los ajustaremos proporcionalmente.'}
                        </p>
                      )}
                    </div>
                  )}
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
                    <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-1 text-slate-900">
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
                      ? 'Take a look back at what you answered in Phase 0 (your business type, niche, and offer) to confirm these goals still make sense for your business. You can still go back and edit any field.'
                      : 'Revisa lo que respondiste en la Fase 0 (tu giro, nicho y oferta) para confirmar que estas metas sigan alineadas con tu negocio. Todavía puedes regresar y editar cualquier campo.'}
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

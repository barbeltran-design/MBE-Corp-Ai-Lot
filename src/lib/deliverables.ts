import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

// ==========================================================================
// PDF DEL PLAN COMPILADO — presentación ejecutiva con iconos
// ==========================================================================

type Rgb = [number, number, number];

// Paleta institucional MBE Corp (derivada del logo):
//   ink #201818 · slate #788080 · teal #30B8D0
const COLOR_PRIMARY: Rgb = [48, 184, 208]; // teal #30B8D0
const COLOR_DARK: Rgb = [32, 24, 24]; // ink #201818
const COLOR_MUTED: Rgb = [120, 128, 128]; // slate #788080
const COLOR_GREEN: Rgb = [22, 163, 74]; // green-600
const COLOR_AMBER: Rgb = [180, 83, 9]; // amber-700
const COLOR_LINE: Rgb = [226, 232, 240]; // slate-200
const COLOR_HEADER_BG: Rgb = [225, 246, 250]; // teal-50 (#E1F6FA)

interface InlineSegment {
  text: string;
  bold: boolean;
}

function sanitizePdfText(text: string): string {
  // Los PDF estándar usan WinAnsi: cualquier carácter fuera de ese rango
  // (emojis, etc.) se elimina para no imprimir basura.
  return text.replace(/[^\u0020-\u00FF]/g, '');
}

function parseInline(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  sanitizePdfText(text)
    .split('**')
    .forEach(function (part, i) {
      if (!part) return;
      segments.push({ text: part, bold: i % 2 === 1 });
    });
  return segments;
}

function plainText(text: string): string {
  return sanitizePdfText(text).replace(/\*\*/g, '');
}

function isTableLine(line: string): boolean {
  const t = line.trim();
  return t.startsWith('|') && t.endsWith('|');
}

function isTableSeparator(line: string): boolean {
  return /^\|[\s:|-]+\|$/.test(line.trim());
}

function parseTableRow(line: string): string[] {
  return line
    .split('|')
    .slice(1, -1)
    .map(function (c) { return c.trim(); });
}

const DINGBAT_CHECK = 'B'; // ✓
const DINGBAT_DOT = 'U'; // ●
const DINGBAT_BOX = 'W'; // ■

class CompiledPlanRenderer {
  doc: jsPDF;
  lang: 'es' | 'en';
  marginX: number;
  marginTop: number;
  marginBottom: number;
  pageWidth: number;
  pageHeight: number;
  usableWidth: number;
  cursorY: number;

  constructor(doc: jsPDF, lang: 'es' | 'en') {
    this.doc = doc;
    this.lang = lang;
    this.marginX = 48;
    this.marginTop = 56;
    this.marginBottom = 56;
    this.pageWidth = doc.internal.pageSize.getWidth();
    this.pageHeight = doc.internal.pageSize.getHeight();
    this.usableWidth = this.pageWidth - this.marginX * 2;
    this.cursorY = this.marginTop;
  }

  ensureSpace(needed: number): void {
    if (this.cursorY + needed > this.pageHeight - this.marginBottom) {
      this.doc.addPage();
      this.cursorY = this.marginTop;
    }
  }

  setColor(color: Rgb): void {
    this.doc.setTextColor(color[0], color[1], color[2]);
  }

  inlineWidth(segments: InlineSegment[], size: number): number {
    let width = 0;
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      this.doc.setFont('helvetica', seg.bold ? 'bold' : 'normal');
      this.doc.setFontSize(size);
      width += this.doc.getTextWidth(seg.text);
    }
    return width;
  }

  writeInline(x: number, y: number, segments: InlineSegment[], size: number): void {
    let xCursor = x;
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      this.doc.setFont('helvetica', seg.bold ? 'bold' : 'normal');
      this.doc.setFontSize(size);
      this.doc.text(seg.text, xCursor, y);
      xCursor += this.doc.getTextWidth(seg.text);
    }
  }

  icon(glyph: string, x: number, y: number, size: number, color: Rgb): void {
    this.doc.setFont('zapfdingbats', 'normal');
    this.doc.setFontSize(size);
    this.setColor(color);
    this.doc.text(glyph, x, y);
  }

  heading(text: string, size: number): void {
    const segments = parseInline(text);
    const lineHeight = size + 8;
    this.ensureSpace(lineHeight + 10);
    const isBlindSpot = text.includes('Punto ciego') || text.includes('Blind spot');
    const color = isBlindSpot ? COLOR_AMBER : COLOR_PRIMARY;
    this.icon(isBlindSpot ? DINGBAT_BOX : DINGBAT_DOT, this.marginX, this.cursorY + size * 0.75, size * 0.8, color);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(size);
    this.setColor(color);
    this.writeInline(this.marginX + 16, this.cursorY + size * 0.75, segments, size);
    this.doc.setDrawColor(COLOR_LINE[0], COLOR_LINE[1], COLOR_LINE[2]);
    this.doc.line(this.marginX, this.cursorY + size + 4, this.pageWidth - this.marginX, this.cursorY + size + 4);
    this.cursorY += lineHeight + 10;
  }

  paragraph(text: string, size = 11, indent = 0): void {
    const segments = parseInline(text);
    const isBlindSpot = text.includes('Punto ciego') || text.includes('Blind spot');
    const color = isBlindSpot ? COLOR_AMBER : COLOR_DARK;
    const width = this.usableWidth - indent;
    const rawLines = this.doc.splitTextToSize(plainText(text), width);
    const lines = Array.isArray(rawLines) ? rawLines : [rawLines];
    const lineHeight = size + 4;
    for (let i = 0; i < lines.length; i++) {
      this.ensureSpace(lineHeight);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setFontSize(size);
      this.setColor(color);
      if (i === 0) {
        this.writeInline(this.marginX + indent, this.cursorY, segments, size);
      } else {
        this.doc.text(lines[i], this.marginX + indent, this.cursorY);
      }
      this.cursorY += lineHeight;
    }
    this.cursorY += 3;
  }

  bullet(text: string): void {
    const segments = parseInline(text);
    const indent = 18;
    const width = this.usableWidth - indent;
    const rawLines = this.doc.splitTextToSize(plainText(text), width);
    const lines = Array.isArray(rawLines) ? rawLines : [rawLines];
    const lineHeight = 15;
    for (let i = 0; i < lines.length; i++) {
      this.ensureSpace(lineHeight);
      if (i === 0) {
        this.icon(DINGBAT_CHECK, this.marginX + 2, this.cursorY - 1, 10, COLOR_GREEN);
        this.doc.setFont('helvetica', 'normal');
        this.doc.setFontSize(11);
        this.setColor(COLOR_DARK);
        this.writeInline(this.marginX + indent, this.cursorY, segments, 11);
      } else {
        this.doc.setFont('helvetica', 'normal');
        this.doc.setFontSize(11);
        this.setColor(COLOR_DARK);
        this.doc.text(lines[i], this.marginX + indent, this.cursorY);
      }
      this.cursorY += lineHeight;
    }
    this.cursorY += 2;
  }

  numbered(number: string, text: string): void {
    const segments = parseInline(text);
    const indent = 20;
    const width = this.usableWidth - indent;
    const rawLines = this.doc.splitTextToSize(plainText(text), width);
    const lines = Array.isArray(rawLines) ? rawLines : [rawLines];
    const lineHeight = 15;
    for (let i = 0; i < lines.length; i++) {
      this.ensureSpace(lineHeight);
      if (i === 0) {
        this.doc.setFont('helvetica', 'bold');
        this.doc.setFontSize(11);
        this.setColor(COLOR_PRIMARY);
        this.doc.text(number + '.', this.marginX + 2, this.cursorY);
        this.doc.setFont('helvetica', 'normal');
        this.setColor(COLOR_DARK);
        this.writeInline(this.marginX + indent, this.cursorY, segments, 11);
      } else {
        this.doc.setFont('helvetica', 'normal');
        this.doc.setFontSize(11);
        this.setColor(COLOR_DARK);
        this.doc.text(lines[i], this.marginX + indent, this.cursorY);
      }
      this.cursorY += lineHeight;
    }
    this.cursorY += 2;
  }

  divider(): void {
    this.ensureSpace(20);
    this.cursorY += 6;
    this.doc.setDrawColor(COLOR_LINE[0], COLOR_LINE[1], COLOR_LINE[2]);
    this.doc.setLineWidth(0.8);
    this.doc.line(this.marginX, this.cursorY, this.pageWidth - this.marginX, this.cursorY);
    this.cursorY += 12;
  }

  table(rows: string[][]): void {
    if (rows.length === 0) return;
    const colCount = Math.max.apply(
      null,
      rows.map(function (r) { return r.length; })
    );
    const cellFont = 9.5;
    const paddX = 6;
    const headerH = 18;
    const rowH = 15;

    const colWidths: number[] = [];
    for (let c = 0; c < colCount; c++) {
      let maxLen = 0;
      for (const r of rows) {
        const cell = (r[c] ?? '').replace(/\*\*/g, '');
        if (cell.length > maxLen) maxLen = cell.length;
      }
      colWidths.push(Math.max(34, Math.min(maxLen * 5.2 + paddX * 2, 220)));
    }
    const totalWidth = colWidths.reduce(function (s, w) { return s + w; }, 0);
    const scale = totalWidth > this.usableWidth ? this.usableWidth / totalWidth : 1;
    const widths = colWidths.map(function (w) { return w * scale; });

    const rowCount = rows.length;
    const tableHeight = headerH + (rowCount - 1) * rowH;
    this.ensureSpace(tableHeight);

    let x = this.marginX;
    let y = this.cursorY;
    this.doc.setDrawColor(COLOR_LINE[0], COLOR_LINE[1], COLOR_LINE[2]);
    this.doc.setLineWidth(0.6);

    rows.forEach((r, ri) => {
      const isHeader = ri === 0;
      const rowHReal = isHeader ? headerH : rowH;
      if (isHeader) {
        this.doc.setFillColor(COLOR_HEADER_BG[0], COLOR_HEADER_BG[1], COLOR_HEADER_BG[2]);
        this.doc.rect(x, y, widths.reduce(function (s, w) { return s + w; }, 0), rowHReal, 'F');
      }
      let cellX = x;
      for (let c = 0; c < colCount; c++) {
        this.doc.rect(cellX, y, widths[c], rowHReal, 'S');
        const text = sanitizePdfText(r[c] ?? '').replace(/\*\*/g, '');
        const wrapped = this.doc.splitTextToSize(text, widths[c] - paddX * 2);
        const lines = Array.isArray(wrapped) ? wrapped : [wrapped];
        const linesToDraw = lines.slice(0, 2);
        linesToDraw.forEach((l, li) => {
          this.doc.setFont('helvetica', isHeader ? 'bold' : 'normal');
          this.doc.setFontSize(cellFont);
          this.doc.setTextColor(
            isHeader ? COLOR_PRIMARY[0] : COLOR_DARK[0],
            isHeader ? COLOR_PRIMARY[1] : COLOR_DARK[1],
            isHeader ? COLOR_PRIMARY[2] : COLOR_DARK[2]
          );
          this.doc.text(String(l), cellX + paddX, y + rowHReal / 2 + (li - (linesToDraw.length - 1) / 2) * 11);
        });
        cellX += widths[c];
      }
      y += rowHReal;
    });

    this.cursorY = y + 10;
  }

  cover(title: string, topic: string, logo?: { dataUrl: string; w: number; h: number }): void {
    const isEn = this.lang === 'en';
    if (logo) {
      try {
        this.doc.addImage(logo.dataUrl, 'PNG', this.marginX, 88, logo.w, logo.h);
      } catch {
        // logo opcional: si falla, se continúa sin él
      }
    }
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(11);
    this.setColor(COLOR_PRIMARY);
    this.doc.text('MBE CORPILOT AI', this.marginX, 150);

    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(34);
    this.setColor(COLOR_DARK);
    this.doc.text(title, this.marginX, 210);

    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(18);
    this.setColor(COLOR_PRIMARY);
    this.doc.text(
      isEn ? 'Strategic Business Plan' : 'Plan de Negocio Estratégico Socioambiental',
      this.marginX,
      240
    );

    this.doc.setDrawColor(COLOR_PRIMARY[0], COLOR_PRIMARY[1], COLOR_PRIMARY[2]);
    this.doc.setLineWidth(1.5);
    this.doc.line(this.marginX, 262, this.marginX + 120, 262);

    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(13);
    this.setColor(COLOR_MUTED);
    const topicLines = this.doc.splitTextToSize(topic, this.usableWidth);
    const topicArr = Array.isArray(topicLines) ? topicLines : [topicLines];
    let ty = 300;
    for (const line of topicArr) {
      this.doc.text(line, this.marginX, ty);
      ty += 19;
    }

    const meta: [string, string][] = isEn
      ? [
          [DINGBAT_CHECK, '5 phases of the Babel diagnostic (0 to 4)'],
          [DINGBAT_BOX, 'Generated by Babel AI — MBE Corpilot'],
          [DINGBAT_DOT, new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'long', year: 'numeric' })],
        ]
      : [
          [DINGBAT_CHECK, '5 fases del diagnóstico Babel (0 a 4)'],
          [DINGBAT_BOX, 'Generado por Babel AI — MBE Corpilot'],
          [DINGBAT_DOT, new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })],
        ];

    let my = 400;
    for (let m = 0; m < meta.length; m++) {
      const item = meta[m];
      this.icon(item[0], this.marginX, my, 10, COLOR_PRIMARY);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setFontSize(11);
      this.setColor(COLOR_MUTED);
      this.doc.text(item[1], this.marginX + 18, my);
      my += 22;
    }

    this.doc.addPage();
    this.cursorY = this.marginTop;
  }

  addFooters(): void {
    const total = this.doc.getNumberOfPages();
    for (let p = 1; p <= total; p++) {
      this.doc.setPage(p);
      const footerY = this.pageHeight - 36;
      this.doc.setDrawColor(COLOR_LINE[0], COLOR_LINE[1], COLOR_LINE[2]);
      this.doc.setLineWidth(0.6);
      this.doc.line(this.marginX, footerY - 8, this.pageWidth - this.marginX, footerY - 8);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setFontSize(8.5);
      this.setColor(COLOR_MUTED);
      const brand = this.lang === 'en' ? 'MBE Corpilot AI — Babel' : 'MBE Corpilot AI — Babel';
      this.doc.text(brand, this.marginX, footerY);
      this.doc.text(
        (this.lang === 'en' ? 'Page ' : 'Página ') + p + ' ' + (this.lang === 'en' ? 'of' : 'de') + ' ' + total,
        this.pageWidth - this.marginX,
        footerY,
        { align: 'right' }
      );
    }
  }
}

export interface DownloadCompiledPlanParams {
  sessionTopic: string;
  compiledText: string;
  language: 'es' | 'en';
}

function logoDimensions(dataUrl: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve({ w: 0, h: 0 });
    img.src = dataUrl;
  });
}

function renderCompiledPlanPdf(params: DownloadCompiledPlanParams & { logo?: { dataUrl: string; w: number; h: number } }): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const renderer = new CompiledPlanRenderer(doc, params.language);
  const isEn = params.language === 'en';
  const title = isEn ? 'Business Plan' : 'Plan de Negocio';

  renderer.cover(title, params.sessionTopic, params.logo);

  const lines = params.compiledText.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) {
      i++;
      continue;
    }
    if (isTableLine(line)) {
      const rows: string[][] = [];
      while (i < lines.length && isTableLine(lines[i])) {
        if (!isTableSeparator(lines[i])) rows.push(parseTableRow(lines[i]));
        i++;
      }
      renderer.table(rows);
      continue;
    }
    if (/^---+$/.test(line)) {
      renderer.divider();
      i++;
      continue;
    }
    const headingMatch = line.match(/^(#{1,6})\s*(.*)$/);
    if (headingMatch) {
      const headingText = headingMatch[2].replace(/\s*#+\s*$/, '').trim();
      if (headingText) {
        const level = headingMatch[1].length;
        const size = level === 1 ? 15 : level === 2 ? 14 : 12.5;
        renderer.heading(headingText, size);
      }
      i++;
      continue;
    }
    if (line.startsWith('>')) {
      renderer.paragraph(line.replace(/^>\s?/, ''));
      i++;
      continue;
    }
    if (line.startsWith('- ')) {
      renderer.bullet(line.slice(2));
      i++;
      continue;
    }
    if (line.startsWith('* ')) {
      renderer.bullet(line.slice(2));
      i++;
      continue;
    }
    const numberedMatch = line.match(/^(\d+)\.\s+(.*)$/);
    if (numberedMatch) {
      renderer.numbered(numberedMatch[1], numberedMatch[2]);
      i++;
      continue;
    }
    renderer.paragraph(line);
    i++;
  }

  renderer.addFooters();
  return doc;
}

export async function downloadCompiledPlanPdf(params: DownloadCompiledPlanParams): Promise<void> {
  let logo: { dataUrl: string; w: number; h: number } | undefined;
  try {
    const res = await fetch('/logo-mbe.png');
    if (res.ok) {
      const blob = await res.blob();
      const dataUrl = await new Promise<string | undefined>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : undefined);
        reader.onerror = () => resolve(undefined);
        reader.readAsDataURL(blob);
      });
      if (dataUrl) {
        const dims = await logoDimensions(dataUrl);
        if (dims.w > 0 && dims.h > 0) {
          const logoW = 56;
          logo = { dataUrl, w: logoW, h: Math.max(8, Math.round((logoW * dims.h) / dims.w)) };
        }
      }
    }
  } catch {
    // sin logo, sin problema
  }
  const doc = renderCompiledPlanPdf({ ...params, logo });
  const fileName =
    params.language === 'en' ? 'business-plan.pdf' : 'plan-de-negocio.pdf';
  doc.save(fileName);
}

// ==========================================================================
// HELPERS COMPARTIDOS PARA EXCEL (SheetJS)
// ==========================================================================

type Row = (string | number)[];

function row(...items: Row): Row {
  return items;
}

function colLetter(n: number): string {
  let s = '';
  let num = n;
  while (num > 0) {
    const rem = (num - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    num = Math.floor((num - 1) / 26);
  }
  return s;
}

function patchCell(ws: any, addr: string, patch: { f?: string; z?: string }): void {
  if (!ws[addr]) {
    ws[addr] = { t: 'n', v: 0 };
  }
  if (patch.f !== undefined) {
    ws[addr].f = patch.f;
  }
  if (patch.z !== undefined) {
    ws[addr].z = patch.z;
  }
}

// ==========================================================================
// OBJETIVOS FINANCIEROS: TABLA DE CRECIMIENTO SEGUN % DE MERCADOTECNIA
// ==========================================================================

const GROWTH_TIERS: { max: number; rate: number }[] = [
  { max: 0, rate: 0 },
  { max: 0.02, rate: 0.01 },
  { max: 0.05, rate: 0.02 },
  { max: 0.10, rate: 0.04 },
  { max: 0.15, rate: 0.06 },
  { max: Infinity, rate: 0.08 },
];

function growthRateForPct(pct: number): number {
  for (const tier of GROWTH_TIERS) {
    if (pct <= tier.max) return tier.rate;
  }
  return 0.08;
}

// ==========================================================================
// OBJETIVOS FINANCIEROS: TIPOS
// ==========================================================================

export interface FinancialGoalsFixedItem {
  name: string;
  amount: number;
}

export interface FinancialGoalsVarItem {
  name: string;
  pct: number;
}

export interface FinancialGoalsChannel {
  name: string;
  pct: number;
}

export interface FinancialGoalsInput {
  language: 'es' | 'en';
  unitPrice: number;
  materialsPct: number;
  laborPct: number;
  otherVarPct: number;
  fixedItems: FinancialGoalsFixedItem[];
  fixedTotalFallback: number;
  varItems: FinancialGoalsVarItem[];
  desiredProfit: number;
  channels: FinancialGoalsChannel[];
  marketingPct: number;
}

export interface FinancialGoalsResult {
  totalVariablePct: number;
  fixedTotal: number;
  breakEven: number;
  targetRevenue: number;
  totalVariablePctWithMarketing: number;
  breakEvenWithMarketing: number;
  targetRevenueWithMarketing: number;
  requiredGrowthRate: number;
  expectedGrowthRate: number;
  isSufficient: boolean;
  recommendedMarketingPct: number | null;
  recommendedMarketingAmount: number | null;
}

// ==========================================================================
// OBJETIVOS FINANCIEROS: CALCULO
// ==========================================================================

export function computeFinancialGoals(input: FinancialGoalsInput): FinancialGoalsResult {
  const varItemsPct = input.varItems.reduce(function (s, v) {
    return s + (v.pct || 0);
  }, 0);
  const totalVariablePct = input.materialsPct + input.laborPct + input.otherVarPct + varItemsPct;

  const fixedTotal =
    input.fixedItems.length > 0
      ? input.fixedItems.reduce(function (s, f) {
          return s + (f.amount || 0);
        }, 0)
      : input.fixedTotalFallback;

  const denomBase = 1 - totalVariablePct;
  const breakEven = denomBase > 0 ? fixedTotal / denomBase : 0;
  const targetRevenue = denomBase > 0 ? (fixedTotal + input.desiredProfit) / denomBase : 0;

  const totalVariablePctWithMarketing = totalVariablePct + input.marketingPct;
  const denomMkt = 1 - totalVariablePctWithMarketing;
  const breakEvenWithMarketing = denomMkt > 0 ? fixedTotal / denomMkt : 0;
  const targetRevenueWithMarketing = denomMkt > 0 ? (fixedTotal + input.desiredProfit) / denomMkt : 0;

  let requiredGrowthRate = 0;
  if (breakEvenWithMarketing > 0 && targetRevenueWithMarketing > breakEvenWithMarketing) {
    requiredGrowthRate = Math.pow(targetRevenueWithMarketing / breakEvenWithMarketing, 1 / 11) - 1;
  }

  const expectedGrowthRate = growthRateForPct(input.marketingPct);
  const isSufficient = expectedGrowthRate >= requiredGrowthRate;

  let recommendedMarketingPct: number | null = null;
  let recommendedMarketingAmount: number | null = null;

  if (!isSufficient) {
    const candidates = [0.02, 0.05, 0.10, 0.15, 0.20];
    let found = false;
    for (const candidatePct of candidates) {
      const candTotalVarPct = totalVariablePct + candidatePct;
      const candDenom = 1 - candTotalVarPct;
      if (candDenom <= 0) continue;
      const candBreakEven = fixedTotal / candDenom;
      const candTarget = (fixedTotal + input.desiredProfit) / candDenom;
      const candRequiredRate =
        candBreakEven > 0 && candTarget > candBreakEven
          ? Math.pow(candTarget / candBreakEven, 1 / 11) - 1
          : 0;
      const candExpectedRate = growthRateForPct(candidatePct);
      if (candExpectedRate >= candRequiredRate) {
        recommendedMarketingPct = candidatePct;
        recommendedMarketingAmount = candBreakEven * candidatePct;
        found = true;
        break;
      }
    }
    if (!found) {
      recommendedMarketingPct = null;
      recommendedMarketingAmount = null;
    }
  }

  return {
    totalVariablePct: totalVariablePct,
    fixedTotal: fixedTotal,
    breakEven: breakEven,
    targetRevenue: targetRevenue,
    totalVariablePctWithMarketing: totalVariablePctWithMarketing,
    breakEvenWithMarketing: breakEvenWithMarketing,
    targetRevenueWithMarketing: targetRevenueWithMarketing,
    requiredGrowthRate: requiredGrowthRate,
    expectedGrowthRate: expectedGrowthRate,
    isSufficient: isSufficient,
    recommendedMarketingPct: recommendedMarketingPct,
    recommendedMarketingAmount: recommendedMarketingAmount,
  };
}

// ==========================================================================
// OBJETIVOS FINANCIEROS: EXCEL DE 2 PESTAÑAS
// ==========================================================================

export function downloadFinancialGoalsExcel(input: FinancialGoalsInput): void {
  const lang = input.language;
  const result = computeFinancialGoals(input);

  const L =
    lang === 'en'
      ? {
          sheet1: 'Break-even Goals',
          sheet2: '12-Month Projection',
          title1: 'Break-even Goals',
          unitPrice: 'Unit Price',
          materialsPct: '% Materials',
          laborPct: '% Labor',
          otherPct: '% Other Variable Costs',
          totalVarPct: '% Total Variable Costs',
          fixedCostsHeader: 'Fixed Costs',
          item: 'Item',
          amount: 'Amount',
          fixedTotal: 'Total Fixed Costs',
          desiredProfit: 'Desired Monthly Profit',
          breakEven: 'Break-even Point ($)',
          targetRevenue: 'Revenue Needed for Your Goal ($)',
          channelsHeader: 'Revenue Channels',
          channel: 'Channel',
          channelPct: '% Share',
          atBreakEven: 'Amount at Break-even',
          atTarget: 'Amount at Goal',
          marketingHeader: 'Marketing',
          marketingPct: '% Invested in Marketing',
          expectedGrowth: 'Expected Monthly Growth',
          requiredGrowth: 'Required Monthly Growth',
          sufficient: 'Is it enough?',
          yes: 'Yes',
          no: 'No',
          recommendation: 'Recommendation',
          recommendationNone: 'Not achievable in 12 months even with high investment',
          month: 'Month',
          totalIncome: 'Total Revenue',
          variableCosts: 'Variable Costs',
          fixedCostsRow: 'Fixed Costs',
          marketingRow: 'Marketing',
          totalCost: 'Total Cost',
          monthlyProfit: 'Monthly Profit',
          accumulatedProfit: 'Accumulated Profit',
          growthAssumption: 'Growth Assumption',
          growthLabel: 'Monthly growth % (editable)',
          growthNote: 'Change this cell to update the whole projection',
          requiredNote: 'Reference: required rate to hit goal by month 12',
        }
      : {
          sheet1: 'Metas al Punto de Equilibrio',
          sheet2: 'Proyeccion 12 Meses',
          title1: 'Metas al Punto de Equilibrio',
          unitPrice: 'Precio Unitario',
          materialsPct: '% Materiales',
          laborPct: '% Personal',
          otherPct: '% Otros Costos Variables',
          totalVarPct: '% Costos Variables Totales',
          fixedCostsHeader: 'Gastos Fijos',
          item: 'Concepto',
          amount: 'Monto',
          fixedTotal: 'Total Gastos Fijos',
          desiredProfit: 'Utilidad Mensual Deseada',
          breakEven: 'Punto de Equilibrio ($)',
          targetRevenue: 'Ingreso Necesario para tu Meta ($)',
          channelsHeader: 'Canales de Ingreso',
          channel: 'Canal',
          channelPct: '% Participacion',
          atBreakEven: 'Monto en Equilibrio',
          atTarget: 'Monto en Meta',
          marketingHeader: 'Mercadotecnia',
          marketingPct: '% Invertido en Mercadotecnia',
          expectedGrowth: 'Crecimiento Mensual Esperado',
          requiredGrowth: 'Crecimiento Mensual Necesario',
          sufficient: 'Es suficiente?',
          yes: 'Si',
          no: 'No',
          recommendation: 'Recomendacion',
          recommendationNone: 'No se alcanza en 12 meses ni con una inversion alta',
          month: 'Mes',
          totalIncome: 'Ingresos Totales',
          variableCosts: 'Costos Variables',
          fixedCostsRow: 'Gastos Fijos',
          marketingRow: 'Publicidad',
          totalCost: 'Costo Total',
          monthlyProfit: 'Utilidad Mensual',
          accumulatedProfit: 'Utilidad Acumulada',
          growthAssumption: 'Supuesto de Crecimiento',
          growthLabel: '% crecimiento mensual (editable)',
          growthNote: 'Cambia esta celda para actualizar toda la proyeccion',
          requiredNote: 'Referencia: tasa necesaria para llegar a tu meta en el mes 12',
        };

  // -------------------- HOJA 1: Metas al Punto de Equilibrio --------------------
  const rows1: Row[] = [];
  function pushRow1(r: Row): number {
    rows1.push(r);
    return rows1.length;
  }

  pushRow1(row(L.title1));
  pushRow1([]);

  pushRow1(row(L.unitPrice, input.unitPrice));
  pushRow1(row(L.materialsPct, input.materialsPct));
  pushRow1(row(L.laborPct, input.laborPct));
  pushRow1(row(L.otherPct, input.otherVarPct));
  const totalVarPctRowNum = pushRow1(row(L.totalVarPct, result.totalVariablePctWithMarketing));
  pushRow1([]);

  pushRow1(row(L.fixedCostsHeader));
  let fixedStartRow = 0;
  let fixedEndRow = 0;
  if (input.fixedItems.length > 0) {
    pushRow1(row(L.item, L.amount));
    fixedStartRow = rows1.length + 1;
    for (const f of input.fixedItems) {
      pushRow1(row(f.name, f.amount));
    }
    fixedEndRow = rows1.length;
  }
  const fixedTotalRowNum = pushRow1(row(L.fixedTotal, result.fixedTotal));
  pushRow1([]);

  const desiredProfitRowNum = pushRow1(row(L.desiredProfit, input.desiredProfit));
  const breakEvenRowNum = pushRow1(row(L.breakEven, result.breakEvenWithMarketing));
  const targetRevenueRowNum = pushRow1(row(L.targetRevenue, result.targetRevenueWithMarketing));
  pushRow1([]);

  pushRow1(row(L.channelsHeader));
  pushRow1(row(L.channel, L.channelPct, L.atBreakEven, L.atTarget));
  const channelDataStartRow = rows1.length + 1;
  for (const ch of input.channels) {
    pushRow1(
      row(ch.name, ch.pct, result.breakEvenWithMarketing * ch.pct, result.targetRevenueWithMarketing * ch.pct)
    );
  }
  pushRow1([]);

  pushRow1(row(L.marketingHeader));
  const marketingPctRowNum = pushRow1(row(L.marketingPct, input.marketingPct));
  const expectedGrowthRowNum = pushRow1(row(L.expectedGrowth, result.expectedGrowthRate));
  const requiredGrowthRowNum = pushRow1(row(L.requiredGrowth, result.requiredGrowthRate));
  pushRow1(row(L.sufficient, result.isSufficient ? L.yes : L.no));
  if (!result.isSufficient) {
    const recoText =
      result.recommendedMarketingPct !== null
        ? (result.recommendedMarketingPct * 100).toFixed(0) + '%'
        : L.recommendationNone;
    pushRow1(row(L.recommendation, recoText));
  }

  const ws1: any = XLSX.utils.aoa_to_sheet(rows1);

  patchCell(ws1, 'B3', { z: '#,##0.00' });
  patchCell(ws1, 'B4', { z: '0.0%' });
  patchCell(ws1, 'B5', { z: '0.0%' });
  patchCell(ws1, 'B6', { z: '0.0%' });
  patchCell(ws1, 'B' + totalVarPctRowNum, { z: '0.0%' });

  if (fixedEndRow >= fixedStartRow && fixedStartRow > 0) {
    patchCell(ws1, 'B' + fixedTotalRowNum, {
      f: 'SUM(B' + fixedStartRow + ':B' + fixedEndRow + ')',
      z: '#,##0.00',
    });
    for (let r = fixedStartRow; r <= fixedEndRow; r++) {
      patchCell(ws1, 'B' + r, { z: '#,##0.00' });
    }
  } else {
    patchCell(ws1, 'B' + fixedTotalRowNum, { z: '#,##0.00' });
  }

  patchCell(ws1, 'B' + desiredProfitRowNum, { z: '#,##0.00' });
  patchCell(ws1, 'B' + breakEvenRowNum, {
    f: '(B' + fixedTotalRowNum + ')/(1-B' + totalVarPctRowNum + ')',
    z: '#,##0.00',
  });
  patchCell(ws1, 'B' + targetRevenueRowNum, {
    f: '(B' + fixedTotalRowNum + '+B' + desiredProfitRowNum + ')/(1-B' + totalVarPctRowNum + ')',
    z: '#,##0.00',
  });

  for (let i = 0; i < input.channels.length; i++) {
    const r = channelDataStartRow + i;
    patchCell(ws1, 'B' + r, { z: '0.0%' });
    patchCell(ws1, 'C' + r, { f: 'B' + breakEvenRowNum + '*B' + r, z: '#,##0.00' });
    patchCell(ws1, 'D' + r, { f: 'B' + targetRevenueRowNum + '*B' + r, z: '#,##0.00' });
  }

  patchCell(ws1, 'B' + marketingPctRowNum, { z: '0.0%' });
  patchCell(ws1, 'B' + expectedGrowthRowNum, { z: '0.0%' });
  patchCell(ws1, 'B' + requiredGrowthRowNum, { z: '0.0%' });

  ws1['!cols'] = [{ wch: 34 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];

  // -------------------- HOJA 2: Proyeccion 12 Meses --------------------
  const monthCount = 12;
  const monthHeaders: string[] = [];
  for (let m = 1; m <= monthCount; m++) {
    monthHeaders.push(L.month + ' ' + String(m));
  }

  const revenueVals: number[] = [];
  const variableVals: number[] = [];
  const fixedVals: number[] = [];
  const marketingVals: number[] = [];
  const costVals: number[] = [];
  const profitVals: number[] = [];
  const accumVals: number[] = [];

  let prevRevenue = result.breakEvenWithMarketing;
  let accum = 0;
  for (let m = 0; m < monthCount; m++) {
    const monthRevenue = m === 0 ? result.breakEvenWithMarketing : prevRevenue * (1 + result.expectedGrowthRate);
    const monthVariable = monthRevenue * result.totalVariablePct;
    const monthMarketing = monthRevenue * input.marketingPct;
    const monthFixed = result.fixedTotal;
    const monthCost = monthVariable + monthMarketing + monthFixed;
    const monthProfit = monthRevenue - monthCost;
    accum += monthProfit;

    revenueVals.push(monthRevenue);
    variableVals.push(monthVariable);
    marketingVals.push(monthMarketing);
    fixedVals.push(monthFixed);
    costVals.push(monthCost);
    profitVals.push(monthProfit);
    accumVals.push(accum);

    prevRevenue = monthRevenue;
  }

  const rows2: Row[] = [];
  function pushRow2(r: Row): number {
    rows2.push(r);
    return rows2.length;
  }

  pushRow2(row(L.growthAssumption));
  const growthRateRowNum = pushRow2(row(L.growthLabel, result.expectedGrowthRate));
  const requiredNoteRowNum = pushRow2(row(L.requiredNote, result.requiredGrowthRate));
  const varPctRowNum2 = pushRow2(row(L.totalVarPct, result.totalVariablePct));
  const mktPctRowNum2 = pushRow2(row(L.marketingPct, input.marketingPct));
  pushRow2(row(L.growthNote));
  pushRow2([]);

  pushRow2(row(L.item, ...monthHeaders));
  const revenueRowNum = pushRow2(row(L.totalIncome, ...revenueVals));
  const variableRowNum = pushRow2(row(L.variableCosts, ...variableVals));
  const marketingRowNum = pushRow2(row(L.marketingRow, ...marketingVals));
  const fixedRowNum = pushRow2(row(L.fixedCostsRow, ...fixedVals));
  const costRowNum = pushRow2(row(L.totalCost, ...costVals));
  const profitRowNum2 = pushRow2(row(L.monthlyProfit, ...profitVals));
  const accumRowNum = pushRow2(row(L.accumulatedProfit, ...accumVals));

  const ws2: any = XLSX.utils.aoa_to_sheet(rows2);
  patchCell(ws2, 'B' + growthRateRowNum, { z: '0.0%' });
  patchCell(ws2, 'B' + requiredNoteRowNum, { z: '0.0%' });
  patchCell(ws2, 'B' + varPctRowNum2, { z: '0.0%' });
  patchCell(ws2, 'B' + mktPctRowNum2, { z: '0.0%' });

  for (let m = 1; m <= monthCount; m++) {
    const col = colLetter(m + 1);
    const prevCol = colLetter(m);

    if (m === 1) {
      patchCell(ws2, col + revenueRowNum, { z: '#,##0.00' });
    } else {
      patchCell(ws2, col + revenueRowNum, {
        f: prevCol + revenueRowNum + '*(1+$B$' + growthRateRowNum + ')',
        z: '#,##0.00',
      });
    }
    patchCell(ws2, col + variableRowNum, {
      f: col + revenueRowNum + '*$B$' + varPctRowNum2,
      z: '#,##0.00',
    });
    patchCell(ws2, col + marketingRowNum, {
      f: col + revenueRowNum + '*$B$' + mktPctRowNum2,
      z: '#,##0.00',
    });
    patchCell(ws2, col + fixedRowNum, { z: '#,##0.00' });
    patchCell(ws2, col + costRowNum, {
      f: col + variableRowNum + '+' + col + marketingRowNum + '+' + col + fixedRowNum,
      z: '#,##0.00',
    });
    patchCell(ws2, col + profitRowNum2, {
      f: col + revenueRowNum + '-' + col + costRowNum,
      z: '#,##0.00',
    });
    if (m === 1) {
      patchCell(ws2, col + accumRowNum, { f: col + profitRowNum2, z: '#,##0.00' });
    } else {
      patchCell(ws2, col + accumRowNum, {
        f: prevCol + accumRowNum + '+' + col + profitRowNum2,
        z: '#,##0.00',
      });
    }
  }

  const cols2: { wch: number }[] = [{ wch: 26 }];
  for (let m = 0; m < monthCount; m++) cols2.push({ wch: 13 });
  ws2['!cols'] = cols2;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws1, L.sheet1);
  XLSX.utils.book_append_sheet(wb, ws2, L.sheet2);

  const fileName = lang === 'en' ? 'break-even-goals.xlsx' : 'metas-punto-equilibrio.xlsx';
  XLSX.writeFile(wb, fileName);
}

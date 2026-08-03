import jsPDF from 'jspdf';

// ==========================================================================
// PDF DEL PLAN COMPILADO — presentación ejecutiva con iconos
// ==========================================================================

type Rgb = [number, number, number];

// Paleta institucional MBE Corp (colores exactos del logo):
//   ink #221F1F · slate #7F8184 · teal #32BAD0
const COLOR_PRIMARY: Rgb = [50, 186, 208]; // teal #32BAD0
const COLOR_DARK: Rgb = [34, 31, 31]; // ink #221F1F
const COLOR_MUTED: Rgb = [127, 129, 132]; // slate #7F8184
const COLOR_GREEN: Rgb = [22, 163, 74]; // green-600
const COLOR_AMBER: Rgb = [180, 83, 9]; // amber-700
const COLOR_LINE: Rgb = [226, 232, 240]; // slate-200
const COLOR_HEADER_BG: Rgb = [225, 246, 250]; // teal claro (#E1F6FA)

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

async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const res = await fetch('/logo-mbe.png');
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function downloadCompiledPlanPdf(params: DownloadCompiledPlanParams): Promise<void> {
  let logo: { dataUrl: string; w: number; h: number } | undefined;
  const logoDataUrl = await loadLogoDataUrl();
  if (logoDataUrl) {
    const dims = await logoDimensions(logoDataUrl);
    if (dims.w > 0 && dims.h > 0) {
      const logoW = 56;
      logo = { dataUrl: logoDataUrl, w: logoW, h: Math.max(8, Math.round((logoW * dims.h) / dims.w)) };
    }
  }
  const doc = renderCompiledPlanPdf({ ...params, logo });
  const fileName =
    params.language === 'en' ? 'business-plan.pdf' : 'plan-de-negocio.pdf';
  doc.save(fileName);
}

// ==========================================================================
// HELPERS COMPARTIDOS PARA EXCEL
// ==========================================================================

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

export async function downloadFinancialGoalsExcel(input: FinancialGoalsInput): Promise<void> {
  const exjsMod: any = await import('exceljs/dist/exceljs.min.js' as any);
  const ExcelJS = exjsMod.default ?? exjsMod;
  const logoDataUrl = await loadLogoDataUrl();
  const lang = input.language;
  const result = computeFinancialGoals(input);

  const L =
    lang === 'en'
      ? {
          sheet1: 'Break-even Goals',
          sheet2: '12-Month Projection',
          title1: 'Break-even Goals',
          docBy: 'Executive document generated with MBE Corpilot AI',
          businessData: 'Business Data',
          breakEvenSection: 'Break-even',
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
          docBy: 'Documento ejecutivo generado con MBE Corpilot AI',
          businessData: 'Datos de tu Negocio',
          breakEvenSection: 'Punto de Equilibrio',
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
  const ARGB_TEAL = 'FF32BAD0';
  const ARGB_INK = 'FF221F1F';
  const ARGB_SLATE = 'FF7F8184';
  const ARGB_LIGHT = 'FFE1F6FA';
  const ARGB_WHITE = 'FFFFFFFF';
  const ARGB_LINE = 'FFC9D1D9';
  const ARGB_GREEN = 'FF16A34A';
  const ARGB_RED = 'FFDC2626';
  const ARGB_AMBER = 'FFB45309';
  const ARGB_EDITABLE = 'FFFFF3CD';

  function borderAll() {
    return {
      top: { style: 'thin', color: { argb: ARGB_LINE } },
      left: { style: 'thin', color: { argb: ARGB_LINE } },
      bottom: { style: 'thin', color: { argb: ARGB_LINE } },
      right: { style: 'thin', color: { argb: ARGB_LINE } },
    };
  }
  function nextRow(ws: any, values: (string | number)[] = []): number {
    return ws.addRow(values).number;
  }
  function sectionHeader(ws: any, text: string, cols: number): number {
    const r = nextRow(ws, [text]);
    ws.mergeCells(r, 1, r, cols);
    const c = ws.getCell(r, 1);
    c.font = { name: 'Calibri', size: 11, bold: true, color: { argb: ARGB_WHITE } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ARGB_TEAL } };
    c.alignment = { vertical: 'middle', horizontal: 'left' };
    ws.getRow(r).height = 20;
    return r;
  }
  function dataRow(ws: any, label: string, value: number, opts?: { fmt?: string; f?: string; result?: number; bold?: boolean; fill?: string }): number {
    const r = nextRow(ws, [label, value]);
    const lc = ws.getCell(r, 1);
    lc.font = { name: 'Calibri', size: 11, bold: true, color: { argb: ARGB_INK } };
    lc.alignment = { vertical: 'middle', horizontal: 'left' };
    lc.border = borderAll();
    const vc = ws.getCell(r, 2);
    vc.border = borderAll();
    if (opts?.f !== undefined) {
      vc.value = { formula: opts.f, result: opts.result ?? value };
    } else {
      vc.value = value;
    }
    vc.alignment = { vertical: 'middle', horizontal: 'right' };
    vc.font = { name: 'Calibri', size: 11, bold: !!opts?.bold, color: { argb: ARGB_INK } };
    if (opts?.fmt) vc.numFmt = opts.fmt;
    if (opts?.fill) vc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: opts.fill } };
    return r;
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = 'MBE Corpilot AI';
  wb.created = new Date();

  const ws1 = wb.addWorksheet(L.sheet1, { views: [{ showGridLines: false }] });
  ws1.columns = [{ width: 36 }, { width: 18 }, { width: 18 }, { width: 18 }];

  let logoId: number | null = null;
  if (logoDataUrl) {
    logoId = wb.addImage({ base64: logoDataUrl.split(',')[1], extension: 'png' });
    ws1.addImage(logoId, { tl: { col: 0, row: 0 }, ext: { width: 130, height: 71 } });
    for (let i = 1; i <= 4; i++) ws1.getRow(i).height = 18;
  }

  const titleRow1 = nextRow(ws1, [L.title1]);
  ws1.mergeCells(titleRow1, 1, titleRow1, 4);
  ws1.getCell(titleRow1, 1).font = { name: 'Calibri', size: 15, bold: true, color: { argb: ARGB_INK } };
  const subRow1 = nextRow(ws1, [L.docBy]);
  ws1.mergeCells(subRow1, 1, subRow1, 4);
  ws1.getCell(subRow1, 1).font = { name: 'Calibri', size: 10, color: { argb: ARGB_SLATE } };
  nextRow(ws1);

  sectionHeader(ws1, L.businessData, 4);
  dataRow(ws1, L.unitPrice, input.unitPrice, { fmt: '#,##0.00' });
  const totalVarPctRowNum = dataRow(ws1, L.totalVarPct, result.totalVariablePctWithMarketing, { fmt: '0.0%' });
  const desiredProfitRowNum = dataRow(ws1, L.desiredProfit, input.desiredProfit, { fmt: '#,##0.00' });

  sectionHeader(ws1, L.fixedCostsHeader, 4);
  let fixedStartRow = 0;
  let fixedEndRow = 0;
  if (input.fixedItems.length > 0) {
    const hdr = nextRow(ws1, [L.item, L.amount]);
    for (let cc = 1; cc <= 2; cc++) {
      const c = ws1.getCell(hdr, cc);
      c.font = { name: 'Calibri', size: 11, bold: true, color: { argb: ARGB_INK } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ARGB_LIGHT } };
      c.border = borderAll();
      c.alignment = { vertical: 'middle', horizontal: cc === 1 ? 'left' : 'right' };
    }
    fixedStartRow = hdr + 1;
    for (const f of input.fixedItems) {
      const r = nextRow(ws1, [f.name, f.amount]);
      const lc = ws1.getCell(r, 1);
      lc.font = { name: 'Calibri', size: 11, color: { argb: ARGB_INK } };
      lc.border = borderAll();
      lc.alignment = { vertical: 'middle', horizontal: 'left' };
      const vc = ws1.getCell(r, 2);
      vc.font = { name: 'Calibri', size: 11, color: { argb: ARGB_INK } };
      vc.border = borderAll();
      vc.numFmt = '#,##0.00';
      vc.alignment = { vertical: 'middle', horizontal: 'right' };
    }
    fixedEndRow = fixedStartRow + input.fixedItems.length - 1;
  }
  const fixedTotalRowNum = dataRow(ws1, L.fixedTotal, result.fixedTotal, {
    f: input.fixedItems.length > 0 ? 'SUM(B' + fixedStartRow + ':B' + fixedEndRow + ')' : undefined,
    result: result.fixedTotal,
    fmt: '#,##0.00',
    bold: true,
    fill: ARGB_LIGHT,
  });

  sectionHeader(ws1, L.breakEvenSection, 4);
  const breakEvenRowNum = dataRow(ws1, L.breakEven, result.breakEvenWithMarketing, {
    f: '(B' + fixedTotalRowNum + ')/(1-B' + totalVarPctRowNum + ')',
    result: result.breakEvenWithMarketing,
    fmt: '#,##0.00',
    fill: ARGB_LIGHT,
  });
  const targetRevenueRowNum = dataRow(ws1, L.targetRevenue, result.targetRevenueWithMarketing, {
    f: '(B' + fixedTotalRowNum + '+B' + desiredProfitRowNum + ')/(1-B' + totalVarPctRowNum + ')',
    result: result.targetRevenueWithMarketing,
    fmt: '#,##0.00',
    bold: true,
    fill: ARGB_LIGHT,
  });

  sectionHeader(ws1, L.channelsHeader, 4);
  const chHdr = nextRow(ws1, [L.channel, L.channelPct, L.atBreakEven, L.atTarget]);
  for (let cc = 1; cc <= 4; cc++) {
    const c = ws1.getCell(chHdr, cc);
    c.font = { name: 'Calibri', size: 11, bold: true, color: { argb: ARGB_WHITE } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ARGB_TEAL } };
    c.border = borderAll();
    c.alignment = { vertical: 'middle', horizontal: cc === 1 ? 'left' : 'right' };
  }
  for (let i = 0; i < input.channels.length; i++) {
    const ch = input.channels[i];
    const r = nextRow(ws1, [ch.name]);
    const lc = ws1.getCell(r, 1);
    lc.font = { name: 'Calibri', size: 11, bold: true, color: { argb: ARGB_INK } };
    lc.border = borderAll();
    lc.alignment = { vertical: 'middle', horizontal: 'left' };
    const bp = ws1.getCell(r, 2);
    bp.border = borderAll();
    bp.numFmt = '0.0%';
    bp.alignment = { vertical: 'middle', horizontal: 'right' };
    const bc = ws1.getCell(r, 3);
    bc.border = borderAll();
    bc.value = { formula: 'B' + breakEvenRowNum + '*B' + r, result: result.breakEvenWithMarketing * ch.pct };
    bc.numFmt = '#,##0.00';
    bc.alignment = { vertical: 'middle', horizontal: 'right' };
    const tc = ws1.getCell(r, 4);
    tc.border = borderAll();
    tc.value = { formula: 'B' + targetRevenueRowNum + '*B' + r, result: result.targetRevenueWithMarketing * ch.pct };
    tc.numFmt = '#,##0.00';
    tc.alignment = { vertical: 'middle', horizontal: 'right' };
  }

  sectionHeader(ws1, L.marketingHeader, 4);
  dataRow(ws1, L.marketingPct, input.marketingPct, { fmt: '0.0%' });
  dataRow(ws1, L.expectedGrowth, result.expectedGrowthRate, { fmt: '0.0%' });
  dataRow(ws1, L.requiredGrowth, result.requiredGrowthRate, { fmt: '0.0%' });
  const suffRow = nextRow(ws1, [L.sufficient, result.isSufficient ? L.yes : L.no]);
  const sL = ws1.getCell(suffRow, 1);
  sL.font = { name: 'Calibri', size: 11, bold: true, color: { argb: ARGB_INK } };
  sL.border = borderAll();
  sL.alignment = { vertical: 'middle', horizontal: 'left' };
  const sV = ws1.getCell(suffRow, 2);
  sV.border = borderAll();
  sV.alignment = { vertical: 'middle', horizontal: 'right' };
  sV.font = { name: 'Calibri', size: 11, bold: true, color: { argb: result.isSufficient ? ARGB_GREEN : ARGB_RED } };
  if (!result.isSufficient) {
    const recoText =
      result.recommendedMarketingPct !== null
        ? (result.recommendedMarketingPct * 100).toFixed(0) + '%'
        : L.recommendationNone;
    const recRow = nextRow(ws1, [L.recommendation]);
    const rL = ws1.getCell(recRow, 1);
    rL.font = { name: 'Calibri', size: 11, bold: true, color: { argb: ARGB_INK } };
    rL.border = borderAll();
    rL.alignment = { vertical: 'middle', horizontal: 'left' };
    ws1.mergeCells(recRow, 2, recRow, 4);
    const rV = ws1.getCell(recRow, 2);
    rV.value = recoText;
    rV.border = borderAll();
    rV.font = { name: 'Calibri', size: 11, color: { argb: ARGB_AMBER } };
    rV.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  }

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

  const ws2 = wb.addWorksheet(L.sheet2, { views: [{ showGridLines: false }] });
  const cols2: { width: number }[] = [{ width: 30 }];
  for (let m = 0; m < monthCount; m++) cols2.push({ width: 13 });
  ws2.columns = cols2;

  if (logoId !== null) {
    ws2.addImage(logoId, { tl: { col: 0, row: 0 }, ext: { width: 110, height: 60 } });
    for (let i = 1; i <= 4; i++) ws2.getRow(i).height = 15;
  }

  const titleRow2 = nextRow(ws2, [L.sheet2]);
  ws2.mergeCells(titleRow2, 1, titleRow2, 13);
  ws2.getCell(titleRow2, 1).font = { name: 'Calibri', size: 15, bold: true, color: { argb: ARGB_INK } };
  const subRow2 = nextRow(ws2, [L.docBy]);
  ws2.mergeCells(subRow2, 1, subRow2, 13);
  ws2.getCell(subRow2, 1).font = { name: 'Calibri', size: 10, color: { argb: ARGB_SLATE } };
  nextRow(ws2);

  sectionHeader(ws2, L.growthAssumption, 13);
  const growthRateRowNum = dataRow(ws2, L.growthLabel, result.expectedGrowthRate, { fmt: '0.0%', fill: ARGB_EDITABLE });
  const requiredNoteRowNum = dataRow(ws2, L.requiredNote, result.requiredGrowthRate, { fmt: '0.0%' });
  const varPctRowNum2 = dataRow(ws2, L.totalVarPct, result.totalVariablePct, { fmt: '0.0%' });
  const mktPctRowNum2 = dataRow(ws2, L.marketingPct, input.marketingPct, { fmt: '0.0%' });
  const noteRow = nextRow(ws2, [L.growthNote]);
  ws2.mergeCells(noteRow, 1, noteRow, 13);
  const noteCell = ws2.getCell(noteRow, 1);
  noteCell.font = { name: 'Calibri', size: 9, italic: true, color: { argb: ARGB_SLATE } };
  nextRow(ws2);

  const tableHeaderRow = nextRow(ws2, [L.item, ...monthHeaders]);
  for (let cc = 1; cc <= 13; cc++) {
    const c = ws2.getCell(tableHeaderRow, cc);
    c.font = { name: 'Calibri', size: 10, bold: true, color: { argb: ARGB_WHITE } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ARGB_TEAL } };
    c.border = borderAll();
    c.alignment = { vertical: 'middle', horizontal: cc === 1 ? 'left' : 'center' };
  }
  ws2.getRow(tableHeaderRow).height = 18;

  function tableDataRow(label: string, values: number[], opts?: { bold?: boolean; fill?: string }): number {
    const r = nextRow(ws2, [label, ...values]);
    const lc = ws2.getCell(r, 1);
    lc.font = { name: 'Calibri', size: 11, bold: true, color: { argb: ARGB_INK } };
    lc.border = borderAll();
    lc.alignment = { vertical: 'middle', horizontal: 'left' };
    for (let m = 1; m <= monthCount; m++) {
      const c = ws2.getCell(r, m + 1);
      c.font = { name: 'Calibri', size: 11, bold: !!opts?.bold, color: { argb: ARGB_INK } };
      c.border = borderAll();
      c.numFmt = '#,##0.00';
      c.alignment = { vertical: 'middle', horizontal: 'right' };
      if (opts?.fill) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: opts.fill } };
    }
    return r;
  }

  const revenueRowNum = tableDataRow(L.totalIncome, revenueVals);
  const variableRowNum = tableDataRow(L.variableCosts, variableVals);
  const marketingRowNum = tableDataRow(L.marketingRow, marketingVals);
  const fixedRowNum = tableDataRow(L.fixedCostsRow, fixedVals);
  const costRowNum = tableDataRow(L.totalCost, costVals);
  const profitRowNum2 = tableDataRow(L.monthlyProfit, profitVals, { bold: true });
  const accumRowNum = tableDataRow(L.accumulatedProfit, accumVals, { bold: true, fill: ARGB_LIGHT });

  for (let m = 1; m <= monthCount; m++) {
    const col = colLetter(m + 1);
    const prevCol = colLetter(m);
    if (m === 1) {
      ws2.getCell(revenueRowNum, m + 1).value = revenueVals[0];
    } else {
      ws2.getCell(revenueRowNum, m + 1).value = {
        formula: prevCol + revenueRowNum + '*(1+$B$' + growthRateRowNum + ')',
        result: revenueVals[m - 1],
      };
    }
    ws2.getCell(variableRowNum, m + 1).value = {
      formula: col + revenueRowNum + '*$B$' + varPctRowNum2,
      result: variableVals[m - 1],
    };
    ws2.getCell(marketingRowNum, m + 1).value = {
      formula: col + revenueRowNum + '*$B$' + mktPctRowNum2,
      result: marketingVals[m - 1],
    };
    ws2.getCell(costRowNum, m + 1).value = {
      formula: col + variableRowNum + '+' + col + marketingRowNum + '+' + col + fixedRowNum,
      result: costVals[m - 1],
    };
    ws2.getCell(profitRowNum2, m + 1).value = {
      formula: col + revenueRowNum + '-' + col + costRowNum,
      result: profitVals[m - 1],
    };
    ws2.getCell(accumRowNum, m + 1).value = {
      formula: m === 1 ? col + profitRowNum2 : prevCol + accumRowNum + '+' + col + profitRowNum2,
      result: accumVals[m - 1],
    };
  }

  ws2.views = [{ state: 'frozen', xSplit: 1, ySplit: tableHeaderRow - 1, showGridLines: false }];

  const fileName = lang === 'en' ? 'break-even-goals.xlsx' : 'metas-punto-equilibrio.xlsx';

  const wbBuffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([wbBuffer as any], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(function () {
    URL.revokeObjectURL(url);
  }, 10000);
}

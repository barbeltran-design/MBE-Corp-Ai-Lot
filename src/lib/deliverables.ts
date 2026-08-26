import { jsPDF } from 'jspdf';
import type { MaturityDimensionDef } from '@/lib/maturity-dimensions';
import type { AssessmentResult } from '@/lib/maturity-scoring';
import type { MaturityLevel } from '@/types/firestore';

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

  // Divide los segmentos inline en lineas que caben en `width` (respeta el
  // margen derecho; antes la primera linea se dibujaba completa y desbordaba).
  wrapInline(segments: InlineSegment[], size: number, width: number): InlineSegment[][] {
    const lines: InlineSegment[][] = [];
    let line: InlineSegment[] = [];
    let lineW = 0;
    const flush = () => {
      if (line.length > 0) {
        lines.push(line);
        line = [];
        lineW = 0;
      }
    };
    // Un token mas ancho que la linea (URL larga sin espacios, palabra
    // enorme, etc.) no cabe en ninguna linea: se parte por caracteres para
    // que NUNCA desborde el margen derecho.
    const chunkToken = (text: string): string[] => {
      const out: string[] = [];
      let cur = '';
      let curW = 0;
      for (let ci = 0; ci < text.length; ci++) {
        const ch = text.charAt(ci);
        const chW = this.doc.getTextWidth(ch);
        if (cur && curW + chW > width) {
          out.push(cur);
          cur = '';
          curW = 0;
        }
        cur += ch;
        curW += chW;
      }
      if (cur) out.push(cur);
      return out;
    };
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      this.doc.setFont('helvetica', seg.bold ? 'bold' : 'normal');
      this.doc.setFontSize(size);
      // Normaliza cualquier espacio (tabs, NBSP, espacios unicode) a un
      // espacio regular, para que los tokens partan por ahi.
      const tokens = seg.text.replace(/\s+/g, ' ').split(' ');
      for (let ti = 0; ti < tokens.length; ti++) {
        const token = tokens[ti];
        if (token === '') continue;
        const isLast = ti === tokens.length - 1;
        const tokenText = isLast ? token : token + ' ';
        const chunks = chunkToken(tokenText);
        for (let ci = 0; ci < chunks.length; ci++) {
          const chunk = chunks[ci];
          const chunkW = this.doc.getTextWidth(chunk);
          if (line.length > 0 && lineW + chunkW > width) flush();
          line.push({ text: chunk, bold: seg.bold });
          lineW += chunkW;
        }
      }
    }
    flush();
    if (lines.length === 0) lines.push([]);
    return lines;
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
    const wrapped = this.wrapInline(segments, size, this.usableWidth - 16);
    this.ensureSpace(lineHeight * wrapped.length + 10);
    const isBlindSpot = text.includes('Punto ciego') || text.includes('Blind spot');
    const color = isBlindSpot ? COLOR_AMBER : COLOR_PRIMARY;
    for (let li = 0; li < wrapped.length; li++) {
      if (li === 0) {
        this.icon(isBlindSpot ? DINGBAT_BOX : DINGBAT_DOT, this.marginX, this.cursorY + size * 0.75, size * 0.8, color);
      }
      this.doc.setFont('helvetica', 'bold');
      this.doc.setFontSize(size);
      this.setColor(color);
      this.writeInline(this.marginX + 16, this.cursorY + size * 0.75, wrapped[li], size);
      this.cursorY += lineHeight;
    }
    const lineY = this.cursorY - lineHeight + size + 4;
    this.doc.setDrawColor(COLOR_LINE[0], COLOR_LINE[1], COLOR_LINE[2]);
    this.doc.line(this.marginX, lineY, this.pageWidth - this.marginX, lineY);
    this.cursorY += 10;
  }

  paragraph(text: string, size = 11, indent = 0): void {
    const segments = parseInline(text);
    const isBlindSpot = text.includes('Punto ciego') || text.includes('Blind spot');
    const color = isBlindSpot ? COLOR_AMBER : COLOR_DARK;
    const width = this.usableWidth - indent;
    const wrapped = this.wrapInline(segments, size, width);
    const lineHeight = size + 4;
    for (let i = 0; i < wrapped.length; i++) {
      this.ensureSpace(lineHeight);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setFontSize(size);
      this.setColor(color);
      this.writeInline(this.marginX + indent, this.cursorY, wrapped[i], size);
      this.cursorY += lineHeight;
    }
    this.cursorY += 3;
  }

  bullet(text: string): void {
    const segments = parseInline(text);
    const indent = 18;
    const width = this.usableWidth - indent;
    const wrapped = this.wrapInline(segments, 11, width);
    const lineHeight = 15;
    for (let i = 0; i < wrapped.length; i++) {
      this.ensureSpace(lineHeight);
      if (i === 0) {
        this.icon(DINGBAT_CHECK, this.marginX + 2, this.cursorY - 1, 10, COLOR_GREEN);
      }
      this.doc.setFont('helvetica', 'normal');
      this.doc.setFontSize(11);
      this.setColor(COLOR_DARK);
      this.writeInline(this.marginX + indent, this.cursorY, wrapped[i], 11);
      this.cursorY += lineHeight;
    }
    this.cursorY += 2;
  }

  numbered(number: string, text: string): void {
    const segments = parseInline(text);
    const indent = 20;
    const width = this.usableWidth - indent;
    const wrapped = this.wrapInline(segments, 11, width);
    const lineHeight = 15;
    for (let i = 0; i < wrapped.length; i++) {
      this.ensureSpace(lineHeight);
      if (i === 0) {
        this.doc.setFont('helvetica', 'bold');
        this.doc.setFontSize(11);
        this.setColor(COLOR_PRIMARY);
        this.doc.text(number + '.', this.marginX + 2, this.cursorY);
      }
      this.doc.setFont('helvetica', 'normal');
      this.doc.setFontSize(11);
      this.setColor(COLOR_DARK);
      this.writeInline(this.marginX + indent, this.cursorY, wrapped[i], 11);
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
    let cellFont = 9.5;
    const paddX = 6;
    const headerH = 18;
    const rowH = 15;
    const lineSpacing = 11;

    // Ancho por columna para que la palabra mas larga quepa en una linea
    // (evita que se partan las palabras). Se mide con la fuente real de celda.
    const computeWidths = (font: number): { widths: number[]; total: number } => {
      // Se mide en bold: es el peor caso (el header es bold, el cuerpo normal)
      this.doc.setFont('helvetica', 'bold');
      this.doc.setFontSize(font);
      const colWidths: number[] = [];
      for (let c = 0; c < colCount; c++) {
        let maxWordW = 0;
        for (const r of rows) {
          const cell = sanitizePdfText(r[c] ?? '').replace(/\*\*/g, '');
          for (const w of cell.split(/\s+/)) {
            const ww = this.doc.getTextWidth(w);
            if (ww > maxWordW) maxWordW = ww;
          }
        }
        colWidths.push(Math.max(34, Math.min(maxWordW + paddX * 2 + 2, 220)));
      }
      return { widths: colWidths, total: colWidths.reduce(function (s, w) { return s + w; }, 0) };
    };
    let widthsCalc = computeWidths(cellFont);
    if (widthsCalc.total > this.usableWidth && cellFont > 8) {
      cellFont = 8;
      widthsCalc = computeWidths(8);
    }
    const scale = widthsCalc.total > this.usableWidth ? this.usableWidth / widthsCalc.total : 1;
    const widths = widthsCalc.widths.map(function (w) { return w * scale; });

    // Wrap real de cada celda y altura dinámica por fila (las celdas expanden)
    const cellLines: string[][][] = [];
    const rowHeights: number[] = [];
    for (let ri = 0; ri < rows.length; ri++) {
      const r = rows[ri];
      const isHeaderRow = ri === 0;
      const perCell: string[][] = [];
      let maxN = 1;
      for (let c = 0; c < colCount; c++) {
        this.doc.setFont('helvetica', isHeaderRow ? 'bold' : 'normal');
        this.doc.setFontSize(cellFont);
        const text = sanitizePdfText(r[c] ?? '').replace(/\*\*/g, '');
        const wrapped = this.doc.splitTextToSize(text, widths[c] - paddX * 2);
        const lines = Array.isArray(wrapped) ? wrapped : [wrapped];
        perCell.push(lines);
        if (lines.length > maxN) maxN = lines.length;
      }
      cellLines.push(perCell);
      rowHeights.push(Math.max(ri === 0 ? headerH : rowH, maxN * lineSpacing + 4));
    }

    this.doc.setDrawColor(COLOR_LINE[0], COLOR_LINE[1], COLOR_LINE[2]);
    this.doc.setLineWidth(0.6);

    let y = this.cursorY;
    for (let ri = 0; ri < rows.length; ri++) {
      const isHeader = ri === 0;
      const rowHReal = rowHeights[ri];
      if (y + rowHReal > this.pageHeight - this.marginBottom) {
        this.doc.addPage();
        y = this.marginTop;
      }
      if (isHeader) {
        this.doc.setFillColor(COLOR_HEADER_BG[0], COLOR_HEADER_BG[1], COLOR_HEADER_BG[2]);
        this.doc.rect(this.marginX, y, widths.reduce(function (s, w) { return s + w; }, 0), rowHReal, 'F');
      }
      let cellX = this.marginX;
      for (let c = 0; c < colCount; c++) {
        this.doc.rect(cellX, y, widths[c], rowHReal, 'S');
        const lines = cellLines[ri][c];
        lines.forEach((l, li) => {
          this.doc.setFont('helvetica', isHeader ? 'bold' : 'normal');
          this.doc.setFontSize(cellFont);
          this.doc.setTextColor(
            isHeader ? COLOR_PRIMARY[0] : COLOR_DARK[0],
            isHeader ? COLOR_PRIMARY[1] : COLOR_DARK[1],
            isHeader ? COLOR_PRIMARY[2] : COLOR_DARK[2]
          );
          this.doc.text(String(l), cellX + paddX, y + rowHReal / 2 + (li - (lines.length - 1) / 2) * lineSpacing);
        });
        cellX += widths[c];
      }
      y += rowHReal;
    }

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

// ==========================================================================
// PDF DE EVALUACIÓN DE MADUREZ — informe de consultoría ejecutiva
// ==========================================================================

const LEVEL_LABELS_ES: Record<MaturityLevel, string> = {
  execution: 'Ejecución',
  standard: 'Estándar',
  control: 'Control',
  optimization: 'Optimización',
  excellence: 'Excelencia',
  influencer: 'Influencer',
};
const LEVEL_LABELS_EN: Record<MaturityLevel, string> = {
  execution: 'Execution',
  standard: 'Standard',
  control: 'Control',
  optimization: 'Optimization',
  excellence: 'Excellence',
  influencer: 'Influencer',
};

interface MaturityPdfDimension {
  id: string;
  tema: string;
  explicacion: string;
  score: number;
  level: MaturityLevel;
  superados: MaturityLevel[];
  enProgreso: { levelKey: MaturityLevel; description: string; deliverable: string }[];
  pendientes: MaturityLevel[];
  nextStep: { levelKey: MaturityLevel; description: string; deliverable: string } | null;
}

interface MaturityPdfLevelInfo {
  key: MaturityLevel;
  nivel: string;
  pregunta: string;
  explicacion: string;
  maxPoints: number;
}

interface MaturityPdfDimDef {
  id: string;
  tema: string;
  explicacion: string;
  levels: { key: MaturityLevel; description: string; deliverable: string; tutorial: { nivel: string; pregunta: string; explicacion: string }; maxPoints: number }[];
}

class MaturityPdfRenderer {
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

  levelLabel(level: MaturityLevel): string {
    return (this.lang === 'en' ? LEVEL_LABELS_EN : LEVEL_LABELS_ES)[level] ?? level;
  }

  icon(glyph: string, x: number, y: number, size: number, color: Rgb): void {
    this.doc.setFont('zapfdingbats', 'normal');
    this.doc.setFontSize(size);
    this.setColor(color);
    this.doc.text(glyph, x, y);
  }

  cover(logo?: { dataUrl: string; w: number; h: number }): void {
    const isEn = this.lang === 'en';
    if (logo) {
      try { this.doc.addImage(logo.dataUrl, 'PNG', this.marginX, 88, logo.w, logo.h); } catch { /* */ }
    }
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(11);
    this.setColor(COLOR_PRIMARY);
    this.doc.text('MBE CORPILOT AI', this.marginX, 150);

    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(32);
    this.setColor(COLOR_DARK);
    this.doc.text(isEn ? 'Maturity Assessment' : 'Evaluación de Madurez', this.marginX, 210);

    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(16);
    this.setColor(COLOR_PRIMARY);
    this.doc.text(
      isEn ? 'Executive Diagnostic Report for Your Business' : 'Reporte Diagnóstico Ejecutivo para tu Negocio',
      this.marginX,
      238
    );

    this.doc.setDrawColor(COLOR_PRIMARY[0], COLOR_PRIMARY[1], COLOR_PRIMARY[2]);
    this.doc.setLineWidth(1.5);
    this.doc.line(this.marginX, 258, this.marginX + 120, 258);

    const meta: [string, string][] = isEn
      ? [
          [DINGBAT_CHECK, '11 dimensions of organizational maturity'],
          [DINGBAT_BOX, '6 maturity levels per dimension'],
          [DINGBAT_DOT, new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'long', year: 'numeric' })],
        ]
      : [
          [DINGBAT_CHECK, '11 dimensiones de madurez organizacional'],
          [DINGBAT_BOX, '6 niveles de madurez por dimensión'],
          [DINGBAT_DOT, new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })],
        ];

    let my = 310;
    for (const item of meta) {
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

  // ── Section heading (with teal bar) ────────────────────────────────

  sectionHeading(text: string, size = 14): void {
    const segments = parseInline(text);
    const lineHeight = size + 8;
    const wrapped = this.wrapInline(segments, size, this.usableWidth - 16);
    this.ensureSpace(lineHeight * wrapped.length + 14);
    for (let li = 0; li < wrapped.length; li++) {
      if (li === 0) {
        this.icon(DINGBAT_DOT, this.marginX, this.cursorY + size * 0.75, size * 0.8, COLOR_PRIMARY);
      }
      this.doc.setFont('helvetica', 'bold');
      this.doc.setFontSize(size);
      this.setColor(COLOR_PRIMARY);
      this.writeInline(this.marginX + 16, this.cursorY + size * 0.75, wrapped[li], size);
      this.cursorY += lineHeight;
    }
    const lineY = this.cursorY - lineHeight + size + 4;
    this.doc.setDrawColor(COLOR_PRIMARY[0], COLOR_PRIMARY[1], COLOR_PRIMARY[2]);
    this.doc.setLineWidth(0.8);
    this.doc.line(this.marginX, lineY, this.pageWidth - this.marginX, lineY);
    this.cursorY += 10;
  }

  // ── Paragraph ──────────────────────────────────────────────────────

  paragraph(text: string, size = 11, color: Rgb = COLOR_DARK, indent = 0): void {
    const segments = parseInline(text);
    const width = this.usableWidth - indent;
    const wrapped = this.wrapInline(segments, size, width);
    const lineHeight = size + 4;
    for (let i = 0; i < wrapped.length; i++) {
      this.ensureSpace(lineHeight);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setFontSize(size);
      this.setColor(color);
      this.writeInline(this.marginX + indent, this.cursorY, wrapped[i], size);
      this.cursorY += lineHeight;
    }
    this.cursorY += 3;
  }

  // ── Bold paragraph ─────────────────────────────────────────────────

  boldParagraph(text: string, size = 11, color: Rgb = COLOR_DARK): void {
    const segments = parseInline(text).map((s) => ({ ...s, bold: true }));
    const wrapped = this.wrapInline(segments, size, this.usableWidth);
    const lineHeight = size + 4;
    for (let i = 0; i < wrapped.length; i++) {
      this.ensureSpace(lineHeight);
      this.doc.setFont('helvetica', 'bold');
      this.doc.setFontSize(size);
      this.setColor(color);
      this.writeInline(this.marginX, this.cursorY, wrapped[i], size);
      this.cursorY += lineHeight;
    }
    this.cursorY += 3;
  }

  // ── Bullet ─────────────────────────────────────────────────────────

  bullet(text: string, size = 11, color: Rgb = COLOR_DARK): void {
    const segments = parseInline(text);
    const indent = 18;
    const width = this.usableWidth - indent;
    const wrapped = this.wrapInline(segments, size, width);
    const lineHeight = size + 4;
    for (let i = 0; i < wrapped.length; i++) {
      this.ensureSpace(lineHeight);
      if (i === 0) {
        this.icon(DINGBAT_CHECK, this.marginX + 2, this.cursorY - 1, 10, COLOR_GREEN);
      }
      this.doc.setFont('helvetica', 'normal');
      this.doc.setFontSize(size);
      this.setColor(color);
      this.writeInline(this.marginX + indent, this.cursorY, wrapped[i], size);
      this.cursorY += lineHeight;
    }
    this.cursorY += 2;
  }

  // ── Divider ────────────────────────────────────────────────────────

  divider(): void {
    this.ensureSpace(20);
    this.cursorY += 6;
    this.doc.setDrawColor(COLOR_LINE[0], COLOR_LINE[1], COLOR_LINE[2]);
    this.doc.setLineWidth(0.8);
    this.doc.line(this.marginX, this.cursorY, this.pageWidth - this.marginX, this.cursorY);
    this.cursorY += 12;
  }

  // ── Horizontal bar (chart element) ─────────────────────────────────

  horizontalBar(label: string, value: number, maxValue: number, barWidth: number, barHeight: number, color: Rgb): void {
    this.ensureSpace(barHeight + 20);
    // Label
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(10);
    this.setColor(COLOR_DARK);
    const labelLines = this.doc.splitTextToSize(label, this.usableWidth - barWidth - 12);
    const labelArr = Array.isArray(labelLines) ? labelLines : [labelLines];
    let ly = this.cursorY;
    for (const line of labelArr) {
      this.doc.text(line, this.marginX, ly);
      ly += 12;
    }
    const barX = this.marginX;
    const barY = this.cursorY;
    // Background
    this.doc.setFillColor(COLOR_LINE[0], COLOR_LINE[1], COLOR_LINE[2]);
    this.doc.roundedRect(barX, barY, barWidth, barHeight, 3, 3, 'F');
    // Fill
    const fillW = Math.max(0, Math.min((value / maxValue) * barWidth, barWidth));
    this.doc.setFillColor(color[0], color[1], color[2]);
    this.doc.roundedRect(barX, barY, fillW, barHeight, 3, 3, 'F');
    // Value label
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(10);
    this.setColor(COLOR_DARK);
    const valText = Math.round(value) + (this.lang === 'en' ? ' pts' : ' pts');
    this.doc.text(valText, barX + barWidth + 6, barY + barHeight * 0.75);
    this.cursorY = barY + barHeight + 6;
  }

  // ── Level color for bar ────────────────────────────────────────────

  levelColor(level: MaturityLevel): Rgb {
    const order: MaturityLevel[] = ['execution', 'standard', 'control', 'optimization', 'excellence', 'influencer'];
    const idx = order.indexOf(level);
    if (idx <= 1) return [220, 38, 38]; // red-600 for execution/standard
    if (idx === 2) return [234, 179, 8]; // amber-500 for control
    return COLOR_GREEN; // green-600 for optimization+
  }

  // ── Red flag indicator ─────────────────────────────────────────────

  redFlag(text: string): void {
    this.ensureSpace(20);
    this.icon(DINGBAT_BOX, this.marginX, this.cursorY, 10, COLOR_AMBER);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(10);
    this.setColor(COLOR_AMBER);
    this.doc.text(text, this.marginX + 16, this.cursorY);
    this.cursorY += 16;
  }

  // ── Green congrats indicator ───────────────────────────────────────

  congrats(text: string): void {
    this.ensureSpace(20);
    this.icon(DINGBAT_CHECK, this.marginX, this.cursorY, 10, COLOR_GREEN);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(10);
    this.setColor(COLOR_GREEN);
    this.doc.text(text, this.marginX + 16, this.cursorY);
    this.cursorY += 16;
  }

  // ── Wrap / write helpers (same as CompiledPlanRenderer) ────────────

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

  wrapInline(segments: InlineSegment[], size: number, width: number): InlineSegment[][] {
    const lines: InlineSegment[][] = [];
    let line: InlineSegment[] = [];
    let lineW = 0;
    const flush = () => {
      if (line.length > 0) { lines.push(line); line = []; lineW = 0; }
    };
    const chunkToken = (text: string): string[] => {
      const out: string[] = [];
      let cur = '';
      let curW = 0;
      for (let ci = 0; ci < text.length; ci++) {
        const ch = text.charAt(ci);
        const chW = this.doc.getTextWidth(ch);
        if (cur && curW + chW > width) { out.push(cur); cur = ''; curW = 0; }
        cur += ch;
        curW += chW;
      }
      if (cur) out.push(cur);
      return out;
    };
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      this.doc.setFont('helvetica', seg.bold ? 'bold' : 'normal');
      this.doc.setFontSize(size);
      const tokens = seg.text.replace(/\s+/g, ' ').split(' ');
      for (let ti = 0; ti < tokens.length; ti++) {
        const token = tokens[ti];
        if (token === '') continue;
        const isLast = ti === tokens.length - 1;
        const tokenText = isLast ? token : token + ' ';
        const chunks = chunkToken(tokenText);
        for (let ci = 0; ci < chunks.length; ci++) {
          const chunk = chunks[ci];
          const chunkW = this.doc.getTextWidth(chunk);
          if (line.length > 0 && lineW + chunkW > width) flush();
          line.push({ text: chunk, bold: seg.bold });
          lineW += chunkW;
        }
      }
    }
    flush();
    if (lines.length === 0) lines.push([]);
    return lines;
  }

  // ── Footers ────────────────────────────────────────────────────────

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
      this.doc.text('MBE Corpilot AI', this.marginX, footerY);
      this.doc.text(
        (this.lang === 'en' ? 'Page ' : 'Página ') + p + ' ' + (this.lang === 'en' ? 'of' : 'de') + ' ' + total,
        this.pageWidth - this.marginX,
        footerY,
        { align: 'right' }
      );
    }
  }
}

// ── Public render function for maturity assessment PDF ───────────────

export interface MaturityAssessmentPdfParams {
  language: 'es' | 'en';
  result: AssessmentResult;
  dimensions: MaturityDimensionDef[];
  logo?: { dataUrl: string; w: number; h: number };
}

export function renderMaturityAssessmentPdf(params: MaturityAssessmentPdfParams): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const r = new MaturityPdfRenderer(doc, params.language);
  const isEn = params.language === 'en';
  const L = isEn ? LEVEL_LABELS_EN : LEVEL_LABELS_ES;
  const { result, dimensions } = params;

  // ── Cover ──────────────────────────────────────────────────────────
  r.cover(params.logo);

  // ── Section 1: ¿Qué es una evaluación de madurez? ─────────────────
  r.sectionHeading(isEn ? 'What is a Maturity Assessment?' : '¿Qué es una Evaluación de Madurez?');

  const introText = isEn
    ? 'A maturity assessment is a strategic diagnostic tool used by leading consulting firms (McKinsey, EY, PwC, Deloitte) to measure how well an organization manages its key business areas. It evaluates your current operational state across 11 dimensions, assigns a maturity level to each, and provides a clear roadmap for improvement.'
    : 'Una evaluación de madurez es una herramienta diagnóstica estratégica utilizada por las principales firmas de consultoría (McKinsey, EY, PwC, Deloitte) para medir qué tan bien una organización gestiona sus áreas de negocio clave. Evalúa tu estado operativo actual en 11 dimensiones, asigna un nivel de madurez a cada una y proporciona una hoja de ruta clara para la mejora.';
  r.paragraph(introText);

  const whyText = isEn
    ? 'For micro and small businesses, this assessment is especially valuable because it identifies exactly where you stand, what you need to strengthen, and which areas are already performing well. It transforms intuition-based management into data-driven decision-making.'
    : 'Para micro y pequeñas empresas, esta evaluación es especialmente valiosa porque identifica exactamente dónde estás, qué necesitas fortalecer y qué áreas ya están funcionando bien. Transforma la gestión basada en intuición en toma de decisiones basada en datos.';
  r.paragraph(whyText);
  r.divider();

  // ── Section 2: Los 6 niveles de madurez ────────────────────────────
  r.sectionHeading(isEn ? 'The 6 Maturity Levels' : 'Los 6 Niveles de Madurez');

  const levelsIntro = isEn
    ? 'Each dimension is evaluated against six progressive maturity levels. For micro and small businesses, the target is to solidly establish levels 1 through 3 (Execution, Standard, Control). Levels 4 and above represent advanced capabilities that provide competitive advantage.'
    : 'Cada dimensión se evalúa contra seis niveles de madurez progresivos. Para micro y pequeñas empresas, el objetivo es establecer sólidamente los niveles 1 a 3 (Ejecución, Estándar, Control). Los niveles 4 y superiores representan capacidades avanzadas que brindan ventaja competitiva.';
  r.paragraph(levelsIntro);

  const LEVEL_TUTORIAL_ES_DATA: MaturityPdfLevelInfo[] = [
    { key: 'execution', nivel: 'Ejecución Integral', pregunta: '¿Cómo lo ejecuto?', explicacion: 'Qué métodos uso y cómo lo registro', maxPoints: 10 },
    { key: 'standard', nivel: 'Documentación Dinámica', pregunta: '¿Cómo lo documento?', explicacion: 'Documento mis procesos, son dinámicos y están disponibles', maxPoints: 20 },
    { key: 'control', nivel: 'Control Predictivo', pregunta: '¿Cómo lo controlo?', explicacion: 'Tengo alertas de desempeño para anticipar fallas', maxPoints: 20 },
    { key: 'optimization', nivel: 'Mejora Continua Ágil', pregunta: '¿Cómo lo mejoro?', explicacion: 'Elimino oportunamente las fallas de raíz', maxPoints: 20 },
    { key: 'excellence', nivel: 'Excelencia Automatizada', pregunta: '¿Cómo me encamino a ser el mejor?', explicacion: 'Automatizo flujos y descentralizo decisiones', maxPoints: 20 },
    { key: 'influencer', nivel: 'Influencer', pregunta: '¿Cómo influencio en mi industria?', explicacion: 'Inspiro y transformo mi mercado y entorno', maxPoints: 30 },
  ];
  const LEVEL_TUTORIAL_EN_DATA: MaturityPdfLevelInfo[] = [
    { key: 'execution', nivel: 'Integral Execution', pregunta: 'How do I execute it?', explicacion: 'What methods I use and how I record it', maxPoints: 10 },
    { key: 'standard', nivel: 'Dynamic Documentation', pregunta: 'How do I document it?', explicacion: 'I document my processes; they are dynamic and accessible', maxPoints: 20 },
    { key: 'control', nivel: 'Predictive Control', pregunta: 'How do I control it?', explicacion: 'I have performance alerts to anticipate failures', maxPoints: 20 },
    { key: 'optimization', nivel: 'Agile Continuous Improvement', pregunta: 'How do I improve it?', explicacion: 'I promptly eliminate root-cause failures', maxPoints: 20 },
    { key: 'excellence', nivel: 'Automated Excellence', pregunta: 'How do I get on the path to being the best?', explicacion: 'I automate workflows and decentralize decision-making', maxPoints: 20 },
    { key: 'influencer', nivel: 'Influencer', pregunta: 'How do I influence my industry?', explicacion: 'I inspire and transform my market and environment', maxPoints: 30 },
  ];

  const tutorials = isEn ? LEVEL_TUTORIAL_EN_DATA : LEVEL_TUTORIAL_ES_DATA;

  for (let i = 0; i < tutorials.length; i++) {
    const t = tutorials[i];
    const num = String(i + 1);
    const isTarget = i <= 2; // levels 1-3 are the target for micro/small
    const color = isTarget ? COLOR_PRIMARY : COLOR_MUTED;

    r.ensureSpace(50);
    r.doc.setFont('helvetica', 'bold');
    r.doc.setFontSize(12);
    r.setColor(color);
    r.doc.text(num + '.', r.marginX, r.cursorY);
    r.doc.setFont('helvetica', 'bold');
    r.doc.setFontSize(12);
    r.setColor(COLOR_DARK);
    r.doc.text(t.nivel, r.marginX + 20, r.cursorY);
    r.cursorY += 18;

    r.doc.setFont('helvetica', 'italic');
    r.doc.setFontSize(10);
    r.setColor(COLOR_MUTED);
    r.doc.text(t.pregunta + ' — ' + t.explicacion, r.marginX + 20, r.cursorY);
    r.cursorY += 16;

    if (isTarget) {
      r.doc.setFont('helvetica', 'normal');
      r.doc.setFontSize(9);
      r.setColor(COLOR_GREEN);
      const targetMsg = isEn ? '(Target level for micro/small businesses)' : '(Nivel objetivo para micro y pequeñas empresas)';
      r.doc.text(targetMsg, r.marginX + 20, r.cursorY);
      r.cursorY += 14;
    }
    r.cursorY += 4;
  }
  r.divider();

  // ── Section 3: Las 11 dimensiones — qué evalúa cada una ────────────
  r.sectionHeading(isEn ? 'The 11 Dimensions of Maturity' : 'Las 11 Dimensiones de Madurez');

  const dimIntro = isEn
    ? 'Each dimension represents a critical area of your business. For each, we describe what it measures and the evidence (deliverables) expected at each maturity level.'
    : 'Cada dimensión representa un área crítica de tu negocio. Para cada una, describimos qué mide y la evidencia (entregables) esperada en cada nivel de madurez.';
  r.paragraph(dimIntro);

  for (const dim of dimensions) {
    r.ensureSpace(60);
    r.boldParagraph(dim.tema + ' — ' + dim.explicacion, 12, COLOR_PRIMARY);

    // Show levels 1-3 (target) as key reference
    for (let i = 0; i < Math.min(3, dim.levels.length); i++) {
      const lvl = dim.levels[i];
      r.bullet(L[lvl.key] + ': ' + lvl.description, 10, COLOR_DARK);
      r.paragraph('  ' + (isEn ? 'Evidence: ' : 'Evidencia: ') + lvl.deliverable, 9, COLOR_MUTED, 18);
    }
    r.cursorY += 6;
  }
  r.divider();

  // ── Section 4: Dónde estás tú — tus resultados ────────────────────
  r.sectionHeading(isEn ? 'Your Results: Where You Stand' : 'Tus Resultados: Dónde Estás');

  const resultsIntro = isEn
    ? 'Below is your evaluation against the target levels for micro and small businesses. For each dimension, we indicate your current score, maturity level, and whether you need attention (red flag) or deserve recognition (congratulations).'
    : 'A continuación se presenta tu evaluación contra los niveles objetivo para micro y pequeñas empresas. Para cada dimensión, indicamos tu puntaje actual, nivel de madurez, y si necesitas atención (bandera roja) o mereces reconocimiento (felicitaciones).';
  r.paragraph(resultsIntro);

  const redFlags: string[] = [];
  const congratsList: string[] = [];

  for (const dim of result.dimensions) {
    const dimDef = dimensions.find((d) => d.id === dim.id);
    const levelIdx = ['execution', 'standard', 'control', 'optimization', 'excellence', 'influencer'].indexOf(dim.level);
    const isBelowTarget = levelIdx < 2; // below control = red flag
    const isAboveTarget = levelIdx >= 3; // optimization+ = congratulations

    r.ensureSpace(40);
    r.boldParagraph(dim.tema, 11, COLOR_DARK);
    const scoreText = isEn
      ? 'Score: ' + Math.round(dim.score) + ' pts | Level: ' + L[dim.level]
      : 'Puntaje: ' + Math.round(dim.score) + ' pts | Nivel: ' + L[dim.level];
    r.paragraph(scoreText, 10, COLOR_MUTED);

    if (dim.nextStep) {
      const nextText = isEn
        ? 'Next step: ' + dim.nextStep.description
        : 'Siguiente paso: ' + dim.nextStep.description;
      r.paragraph(nextText, 10, COLOR_DARK, 8);
    }

    if (isBelowTarget) {
      const flagText = isEn
        ? 'RED FLAG — ' + dim.tema + ' is below the target level (Control). Priority: strengthen this area.'
        : 'BANDERA ROJA — ' + dim.tema + ' está por debajo del nivel objetivo (Control). Prioridad: fortalecer esta área.';
      r.redFlag(flagText);
      redFlags.push(dim.tema);
    } else if (isAboveTarget) {
      const congText = isEn
        ? 'CONGRATULATIONS — ' + dim.tema + ' exceeds the target level. You have advanced capabilities in this area.'
        : 'FELICITACIONES — ' + dim.tema + ' supera el nivel objetivo. Tienes capacidades avanzadas en esta área.';
      r.congrats(congText);
      congratsList.push(dim.tema);
    }
    r.cursorY += 4;
  }

  // Summary
  r.ensureSpace(60);
  if (redFlags.length > 0) {
    r.boldParagraph(
      isEn
        ? 'Areas requiring attention (' + redFlags.length + '): ' + redFlags.join(', ')
        : 'Áreas que requieren atención (' + redFlags.length + '): ' + redFlags.join(', '),
      10,
      COLOR_AMBER
    );
  }
  if (congratsList.length > 0) {
    r.boldParagraph(
      isEn
        ? 'Areas exceeding target (' + congratsList.length + '): ' + congratsList.join(', ')
        : 'Áreas que superan el objetivo (' + congratsList.length + '): ' + congratsList.join(', '),
      10,
      COLOR_GREEN
    );
  }

  // ── Section 5: Charts ──────────────────────────────────────────────
  r.doc.addPage();
  r.cursorY = r.marginTop;
  r.sectionHeading(isEn ? 'Your Maturity Overview' : 'Tu Panorama de Madurez');

  // Chart 1: Dimension scores bar chart
  const chartTitle1 = isEn ? 'Score by Dimension (max 120 pts)' : 'Puntaje por Dimensión (máx. 120 pts)';
  r.boldParagraph(chartTitle1, 11, COLOR_DARK);

  const barW = r.usableWidth - 60;
  for (const dim of result.dimensions) {
    const col = r.levelColor(dim.level);
    r.horizontalBar(dim.tema, dim.score, 120, barW, 14, col);
  }
  r.cursorY += 8;

  // Chart 2: Level progress
  r.doc.addPage();
  r.cursorY = r.marginTop;
  r.sectionHeading(isEn ? 'Progress by Maturity Level' : 'Avance por Nivel de Madurez');

  const chartTitle2 = isEn
    ? 'How much of your organization has reached each level across all 11 dimensions'
    : 'Cuánto de tu organización ha alcanzado cada nivel en las 11 dimensiones';
  r.paragraph(chartTitle2, 10, COLOR_MUTED);

  for (const lp of result.levelProgress) {
    const label = L[lp.key];
    const isTargetLevel = lp.key === 'execution' || lp.key === 'standard' || lp.key === 'control';
    const col = isTargetLevel ? COLOR_PRIMARY : COLOR_GREEN;
    r.horizontalBar(label, lp.percent, 100, barW, 14, col);
  }
  r.cursorY += 8;

  // ── Section 6: Qué sigue — Recommendations ─────────────────────────
  r.sectionHeading(isEn ? 'What\'s Next: Your Action Plan' : 'Qué Sigue: Tu Plan de Acción');

  // Priority 1: Red flags
  if (redFlags.length > 0) {
    const p1Title = isEn
      ? 'Priority 1: Strengthen areas below target'
      : 'Prioridad 1: Fortalecer áreas por debajo del objetivo';
    r.boldParagraph(p1Title, 12, COLOR_AMBER);

    for (const dim of result.dimensions) {
      const levelIdx = ['execution', 'standard', 'control', 'optimization', 'excellence', 'influencer'].indexOf(dim.level);
      if (levelIdx < 2 && dim.nextStep) {
        r.bullet(dim.tema + ': ' + dim.nextStep.description, 10, COLOR_DARK);
        r.paragraph('  ' + (isEn ? 'Deliverable: ' : 'Entregable: ') + dim.nextStep.deliverable, 9, COLOR_MUTED, 18);
      }
    }
    r.cursorY += 6;
  }

  // Priority 2: En progreso (partial)
  const inProgressDims = result.dimensions.filter((d) => d.enProgreso.length > 0);
  if (inProgressDims.length > 0) {
    const p2Title = isEn
      ? 'Priority 2: Complete partially implemented practices'
      : 'Prioridad 2: Completar prácticas parcialmente implementadas';
    r.boldParagraph(p2Title, 12, COLOR_PRIMARY);

    for (const dim of inProgressDims) {
      for (const ep of dim.enProgreso) {
        r.bullet(dim.tema + ' — ' + L[ep.levelKey] + ': ' + ep.description, 10, COLOR_DARK);
        r.paragraph('  ' + (isEn ? 'Deliverable: ' : 'Entregable: ') + ep.deliverable, 9, COLOR_MUTED, 18);
      }
    }
    r.cursorY += 6;
  }

  // Priority 3: General recommendations
  r.boldParagraph(
    isEn ? 'General Recommendations' : 'Recomendaciones Generales',
    12,
    COLOR_PRIMARY
  );
  const globalPct = Math.round(result.overallScore);
  const recs = isEn
    ? [
        'Focus on completing the first 3 levels (Execution, Standard, Control) across all dimensions before pursuing advanced capabilities.',
        'Use the MBE Corpilot AI platform to track your monthly progress and complete the deliverables for each dimension.',
        'Schedule a session with an expert to review your results and create a personalized action plan.',
      ]
    : [
        'Enfócate en completar los primeros 3 niveles (Ejecución, Estándar, Control) en todas las dimensiones antes de buscar capacidades avanzadas.',
        'Usa la plataforma MBE Corpilot AI para dar seguimiento a tu avance mensual y completar los entregables de cada dimensión.',
        'Agenda una sesión con un experto para revisar tus resultados y crear un plan de acción personalizado.',
      ];
  for (const rec of recs) {
    r.bullet(rec, 10, COLOR_DARK);
  }

  // Global result summary
  r.cursorY += 8;
  r.ensureSpace(60);
  r.boldParagraph(
    isEn
      ? 'Your Global Result: ' + globalPct + ' pts — ' + L[result.overallLevel]
      : 'Tu Resultado Global: ' + globalPct + ' pts — ' + L[result.overallLevel],
    13,
    COLOR_PRIMARY
  );

  const targetMsg = isEn
    ? 'Target for micro/small businesses: solid Execution + Standard + Control (up to 50 pts). ' +
      (globalPct >= 50 ? 'Your business meets or exceeds this target.' : 'Work toward completing these foundational levels.')
    : 'Objetivo para micro y pequeñas empresas: Ejecución + Estándar + Control sólidos (hasta 50 pts). ' +
      (globalPct >= 50 ? 'Tu negocio cumple o supera este objetivo.' : 'Trabaja para completar estos niveles fundamentales.');
  r.paragraph(targetMsg, 10, COLOR_MUTED);

  // ── CTA: Agendar con experto ───────────────────────────────────────
  r.divider();
  r.ensureSpace(80);
  r.boldParagraph(
    isEn ? 'Schedule a Session with an Expert' : 'Agenda una Sesión con un Experto',
    14,
    COLOR_PRIMARY
  );
  const ctaText = isEn
    ? 'Get personalized guidance from a certified MBE mentor. They will review your results, help you prioritize actions, and support your journey toward operational excellence.'
    : 'Obtén orientación personalizada de un mentor certificado MBE. Revisarán tus resultados, te ayudarán a priorizar acciones y acompañarán tu camino hacia la excelencia operativa.';
  r.paragraph(ctaText);
  r.paragraph(
    isEn
      ? 'Visit: mbe-corp-ai-lot.vercel.app/en/agendar'
      : 'Visita: mbe-corp-ai-lot.vercel.app/es/agendar',
    11,
    COLOR_PRIMARY
  );

  r.addFooters();
  return doc;
}

// ── Public download helper ───────────────────────────────────────────

export interface DownloadMaturityAssessmentParams {
  language: 'es' | 'en';
  result: AssessmentResult;
  dimensions: MaturityDimensionDef[];
}

export async function downloadMaturityAssessmentPdf(params: DownloadMaturityAssessmentParams): Promise<void> {
  let logo: { dataUrl: string; w: number; h: number } | undefined;
  const logoDataUrl = await loadLogoDataUrl();
  if (logoDataUrl) {
    const dims = await logoDimensions(logoDataUrl);
    if (dims.w > 0 && dims.h > 0) {
      const logoW = 56;
      logo = { dataUrl: logoDataUrl, w: logoW, h: Math.max(8, Math.round((logoW * dims.h) / dims.w)) };
    }
  }
  const doc = renderMaturityAssessmentPdf({ ...params, logo });
  const fileName = params.language === 'en' ? 'maturity-assessment.pdf' : 'evaluacion-de-madurez.pdf';
  doc.save(fileName);
}

export interface DownloadCompiledPlanParams {
  sessionTopic: string;
  compiledText: string;
  language: 'es' | 'en';
}

/** Limpia el contenido compilado antes de renderizarlo: quita los <br> que la
 * IA deja a veces, la pregunta de aprobación de fase (ya tiene su botón) y
 * cualquier línea que mencione /compilar (recordatorios del prompt). */
export function limpiarContenidoDocumento(texto: string): string {
  return texto
    .replace(/\*?\s*¿Apruebas este resumen de la Fase[^\n]*/gi, '')
    .replace(/\*?\s*Do you approve this Phase[^\n]*/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .split('\n')
    .filter(function (line) { return !/compilar/i.test(line); })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function logoDimensions(dataUrl: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve({ w: 0, h: 0 });
    img.src = dataUrl;
  });
}

export function renderCompiledPlanPdf(params: DownloadCompiledPlanParams & { logo?: { dataUrl: string; w: number; h: number } }): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const renderer = new CompiledPlanRenderer(doc, params.language);
  const isEn = params.language === 'en';
  const title = isEn ? 'Business Plan' : 'Plan de Negocio';

  renderer.cover(title, params.sessionTopic, params.logo);

  const lines = limpiarContenidoDocumento(params.compiledText).split('\n');
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

export interface FinancialGoalsProduct {
  name: string;
  units: number;
  unitMeasure: string;
  unitPrice: number;
  varItems: FinancialGoalsVarItem[];
  pct?: number;
}

export interface FinancialGoalsChannel {
  name: string;
  products?: FinancialGoalsProduct[];
  pct?: number;
}

export interface FinancialGoalsInput {
  language: 'es' | 'en';
  unitPrice?: number;
  materialsPct?: number;
  laborPct?: number;
  otherVarPct?: number;
  fixedItems: FinancialGoalsFixedItem[];
  fixedTotalFallback: number;
  varItems?: FinancialGoalsVarItem[];
  desiredProfit: number;
  channels: FinancialGoalsChannel[];
  marketingPct: number;
}

export interface FinancialChannelSummary {
  name: string;
  pct: number;
  income: number;
  varPct: number;
}

export interface FinancialProductSummary {
  name: string;
  channel: string;
  pct: number;
  income: number;
  varPct: number;
}

export interface FinancialChannelsSummary {
  summaries: FinancialChannelSummary[];
  products: FinancialProductSummary[];
  totalIncome: number;
  totalVarPct: number;
  isLegacy: boolean;
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

export function computeFinancialChannels(input: FinancialGoalsInput): FinancialChannelsSummary {
  const anyProducts = input.channels.some(function (c) {
    return Array.isArray(c.products) && c.products.length > 0;
  });
  if (!anyProducts) {
    const legacyVarPct =
      (input.materialsPct ?? 0) +
      (input.laborPct ?? 0) +
      (input.otherVarPct ?? 0) +
      (input.varItems ?? []).reduce(function (s, v) {
        return s + (v.pct || 0);
      }, 0);
    return {
      summaries: input.channels.map(function (c) {
        return { name: c.name ?? '', pct: c.pct ?? 0, income: 0, varPct: legacyVarPct };
      }),
      products: [],
      totalIncome: 0,
      totalVarPct: legacyVarPct,
      isLegacy: true,
    };
  }
  const rows: { channel: FinancialGoalsChannel; product: FinancialGoalsProduct; income: number; varPct: number }[] = [];
  let totalIncome = 0;
  input.channels.forEach(function (c) {
    (c.products ?? []).forEach(function (p) {
      const income = (p.units || 0) * (p.unitPrice || 0);
      const varPct = (p.varItems ?? []).reduce(function (s, v) {
        return s + (v.pct || 0);
      }, 0);
      totalIncome += income;
      rows.push({ channel: c, product: p, income: income, varPct: varPct });
    });
  });
  const explicitSum = rows.reduce(function (s, r) {
    return s + (typeof r.product.pct === 'number' && isFinite(r.product.pct) && r.product.pct > 0 ? r.product.pct : 0);
  }, 0);
  const useExplicit = explicitSum > 0;
  const products = rows.map(function (r) {
    const explicitPct = typeof r.product.pct === 'number' && isFinite(r.product.pct) && r.product.pct > 0 ? r.product.pct : 0;
    return {
      name: r.product.name ?? '',
      channel: r.channel.name ?? '',
      pct: useExplicit
        ? explicitSum > 0
          ? explicitPct / explicitSum
          : 0
        : totalIncome > 0
          ? r.income / totalIncome
          : 0,
      income: r.income,
      varPct: r.varPct,
    };
  });
  const summaries: FinancialChannelSummary[] = [];
  let idx = 0;
  input.channels.forEach(function (c) {
    let income = 0;
    let weightedVar = 0;
    let pctSum = 0;
    for (let k = idx; k < rows.length; k++) {
      const r = rows[k];
      if (r.channel !== c) break;
      income += r.income;
      weightedVar += r.income * r.varPct;
      pctSum += products[k].pct;
      idx = k + 1;
    }
    summaries.push({
      name: c.name ?? '',
      pct: pctSum,
      income: income,
      varPct: income > 0 ? weightedVar / income : 0,
    });
  });
  const totalVarPct = products.reduce(function (s, p) {
    return s + p.pct * p.varPct;
  }, 0);
  return { summaries: summaries, products: products, totalIncome: totalIncome, totalVarPct: totalVarPct, isLegacy: false };
}

export function computeFinancialGoals(input: FinancialGoalsInput): FinancialGoalsResult {
  const channelSummary = computeFinancialChannels(input);
  const totalVariablePct = channelSummary.totalVarPct;

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
  const finCh = computeFinancialChannels(input);
  const hasProducts = !finCh.isLegacy;

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
          canalesProductosHeader: 'Channels and Products',
          canalLabel: 'Channel',
          productoLabel: 'Product/Service',
          unidadesLabel: 'Units',
          medidaLabel: 'Measure',
          precioUnitLabel: 'Unit Price',
          participacionLabel: '% Participation',
          ingresosLabel: 'Revenue',
          gastosVarLabel: '% Variable Costs',
          totalIngresos: 'Total Monthly Revenue',
          productsAtTargetHeader: 'Products/Services at Goal',
          unitsNeeded: 'Units needed',
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
          canalesProductosHeader: 'Canales y Productos',
          canalLabel: 'Canal',
          productoLabel: 'Producto/Servicio',
          unidadesLabel: 'Unidades',
          medidaLabel: 'Medida',
          precioUnitLabel: 'Precio x Unidad',
          participacionLabel: '% Participacion',
          ingresosLabel: 'Ingresos',
          gastosVarLabel: '% Gastos Variables',
          totalIngresos: 'Ingresos Totales Mensuales',
          productsAtTargetHeader: 'Productos/Servicios en Meta',
          unitsNeeded: 'Unidades requeridas',
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
  ws1.columns = [{ width: 30 }, { width: 22 }, { width: 12 }, { width: 14 }, { width: 15 }, { width: 15 }, { width: 16 }, { width: 18 }];

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
  if (hasProducts) {
    sectionHeader(ws1, L.canalesProductosHeader, 8);
    const prodHdr = nextRow(ws1, [L.canalLabel, L.productoLabel, L.unidadesLabel, L.medidaLabel, L.precioUnitLabel, L.participacionLabel, L.ingresosLabel, L.gastosVarLabel]);
    for (let cc = 1; cc <= 8; cc++) {
      const c = ws1.getCell(prodHdr, cc);
      c.font = { name: 'Calibri', size: 11, bold: true, color: { argb: ARGB_WHITE } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ARGB_TEAL } };
      c.border = borderAll();
      c.alignment = { vertical: 'middle', horizontal: cc === 1 || cc === 2 || cc === 4 ? 'left' : 'right' };
    }
    ws1.getRow(prodHdr).height = 20;
    let firstProdRow = 0;
    let lastProdRow = 0;
    finCh.products.forEach(function (p, i) {
      const prevChannel = i > 0 ? finCh.products[i - 1].channel : null;
      if (prevChannel !== p.channel) {
        if (prevChannel !== null && firstProdRow > 0 && lastProdRow >= firstProdRow) {
          ws1.mergeCells(firstProdRow, 1, lastProdRow, 1);
          const mc = ws1.getCell(firstProdRow, 1);
          mc.value = prevChannel;
          mc.font = { name: 'Calibri', size: 11, bold: true, color: { argb: ARGB_INK } };
          mc.alignment = { vertical: 'middle', horizontal: 'left' };
        }
        firstProdRow = ws1.rowCount + 1;
      }
      const prodSource = input.channels
        .find(function (c) { return c.name === p.channel; })
        ?.products?.find(function (pr) { return pr.name === p.name; });
      const units = prodSource?.units ?? 0;
      const measure = prodSource?.unitMeasure ?? '';
      const unitPrice = prodSource?.unitPrice ?? 0;
      const r = nextRow(ws1, ['', p.name, units, measure, unitPrice, p.pct, p.income, p.varPct]);
      for (let cc = 1; cc <= 8; cc++) {
        const c = ws1.getCell(r, cc);
        c.border = borderAll();
        c.font = { name: 'Calibri', size: 11, color: { argb: ARGB_INK } };
        c.alignment = { vertical: 'middle', horizontal: cc === 1 || cc === 2 || cc === 4 ? 'left' : 'right' };
      }
      ws1.getCell(r, 3).numFmt = '#,##0';
      ws1.getCell(r, 5).numFmt = '#,##0.00';
      ws1.getCell(r, 6).numFmt = '0.0%';
      ws1.getCell(r, 7).numFmt = '#,##0.00';
      ws1.getCell(r, 8).numFmt = '0.0%';
      lastProdRow = r;
    });
    if (firstProdRow > 0 && lastProdRow >= firstProdRow) {
      const lastChannel = finCh.products[finCh.products.length - 1]?.channel ?? '';
      ws1.mergeCells(firstProdRow, 1, lastProdRow, 1);
      const mc = ws1.getCell(firstProdRow, 1);
      mc.value = lastChannel;
      mc.font = { name: 'Calibri', size: 11, bold: true, color: { argb: ARGB_INK } };
      mc.alignment = { vertical: 'middle', horizontal: 'left' };
      dataRow(ws1, L.totalIngresos, finCh.totalIncome, {
        f: 'SUM(G' + firstProdRow + ':G' + lastProdRow + ')',
        result: finCh.totalIncome,
        fmt: '#,##0.00',
        bold: true,
        fill: ARGB_LIGHT,
      });
    }
  } else {
    dataRow(ws1, L.unitPrice, input.unitPrice ?? 0, { fmt: '#,##0.00' });
  }
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

  sectionHeader(ws1, L.channelsHeader, 5);
  const chHdr = nextRow(ws1, [L.channel, L.channelPct, L.gastosVarLabel, L.atBreakEven, L.atTarget]);
  for (let cc = 1; cc <= 5; cc++) {
    const c = ws1.getCell(chHdr, cc);
    c.font = { name: 'Calibri', size: 11, bold: true, color: { argb: ARGB_WHITE } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ARGB_TEAL } };
    c.border = borderAll();
    c.alignment = { vertical: 'middle', horizontal: cc === 1 ? 'left' : 'right' };
  }
  for (let i = 0; i < finCh.summaries.length; i++) {
    const ch = finCh.summaries[i];
    const r = nextRow(ws1, [ch.name]);
    const lc = ws1.getCell(r, 1);
    lc.font = { name: 'Calibri', size: 11, bold: true, color: { argb: ARGB_INK } };
    lc.border = borderAll();
    lc.alignment = { vertical: 'middle', horizontal: 'left' };
    const bp = ws1.getCell(r, 2);
    bp.border = borderAll();
    bp.numFmt = '0.0%';
    bp.alignment = { vertical: 'middle', horizontal: 'right' };
    const vp = ws1.getCell(r, 3);
    vp.border = borderAll();
    vp.value = ch.varPct;
    vp.numFmt = '0.0%';
    vp.alignment = { vertical: 'middle', horizontal: 'right' };
    const bc = ws1.getCell(r, 4);
    bc.border = borderAll();
    bc.value = { formula: 'B' + breakEvenRowNum + '*B' + r, result: result.breakEvenWithMarketing * ch.pct };
    bc.numFmt = '#,##0.00';
    bc.alignment = { vertical: 'middle', horizontal: 'right' };
    const tc = ws1.getCell(r, 5);
    tc.border = borderAll();
    tc.value = { formula: 'B' + targetRevenueRowNum + '*B' + r, result: result.targetRevenueWithMarketing * ch.pct };
    tc.numFmt = '#,##0.00';
    tc.alignment = { vertical: 'middle', horizontal: 'right' };
  }

  if (finCh.products.length > 0) {
    sectionHeader(ws1, L.productsAtTargetHeader, 5);
    const prodHdr2 = nextRow(ws1, [L.channel, L.productoLabel, L.ingresosLabel, L.atTarget, L.unitsNeeded]);
    for (let cc = 1; cc <= 5; cc++) {
      const c = ws1.getCell(prodHdr2, cc);
      c.font = { name: 'Calibri', size: 11, bold: true, color: { argb: ARGB_WHITE } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ARGB_TEAL } };
      c.border = borderAll();
      c.alignment = { vertical: 'middle', horizontal: cc === 1 || cc === 2 ? 'left' : 'right' };
    }
    ws1.getRow(prodHdr2).height = 20;
    finCh.products.forEach(function (p) {
      const prodSource = input.channels
        .find(function (c) { return c.name === p.channel; })
        ?.products?.find(function (pr) { return pr.name === p.name; });
      const unitPrice = prodSource?.unitPrice ?? 0;
      const target = result.targetRevenueWithMarketing * p.pct;
      const units = unitPrice > 0 ? Math.ceil(target / unitPrice) : 0;
      const r = nextRow(ws1, [p.channel, p.name, p.income, target, units]);
      for (let cc = 1; cc <= 5; cc++) {
        const c = ws1.getCell(r, cc);
        c.border = borderAll();
        c.font = { name: 'Calibri', size: 11, color: { argb: ARGB_INK } };
        c.alignment = { vertical: 'middle', horizontal: cc === 1 || cc === 2 ? 'left' : 'right' };
      }
      ws1.getCell(r, 3).numFmt = '#,##0.00';
      ws1.getCell(r, 4).numFmt = '#,##0.00';
      ws1.getCell(r, 5).numFmt = '#,##0';
    });
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

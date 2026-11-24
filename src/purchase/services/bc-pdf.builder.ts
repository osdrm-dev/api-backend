import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';

// shortcut: company header hardcoded, move to config/settings when the client provides official details
export const BC_ISSUER = {
  name: 'OSDRM',
  lines: [] as string[],
};

export interface BCPdfItem {
  designation: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface BCPdfData {
  bcNumber: string;
  date: Date;
  purchaseReference: string;
  purchaseTitle: string;
  buyerName?: string | null;
  supplier: {
    name: string;
    nif?: string | null;
    stat?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
  };
  items: BCPdfItem[];
}

const MARGIN = 40;
const PAGE: [number, number] = [595.28, 841.89]; // A4
const FONT_SIZE = 9;
const LINE = 12;
const BLACK = rgb(0, 0, 0);
const GREY = rgb(0.4, 0.4, 0.4);
const LIGHT = rgb(0.92, 0.92, 0.92);

/** Standard fonts are WinAnsi-only: map common unicode chars, replace the rest. */
export function toWinAnsi(text: string): string {
  return text
    .replace(/[\u00a0\u202f\u2007]/g, ' ')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[^\x20-\x7e\u00a0-\u00ff\u20ac\u2013\u2014\u2026]/g, '?');
}

export function formatAmount(n: number): string {
  const [int, dec] = Math.abs(n).toFixed(2).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${n < 0 ? '-' : ''}${grouped}${dec === '00' ? '' : ',' + dec}`;
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = toWinAnsi(text).split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    // Hard-cut words longer than the column
    let rest = word;
    while (font.widthOfTextAtSize(rest, size) > maxWidth && rest.length > 1) {
      let cut = rest.length - 1;
      while (
        cut > 1 &&
        font.widthOfTextAtSize(rest.slice(0, cut), size) > maxWidth
      )
        cut--;
      lines.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
    current = rest;
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

export async function buildBCPdf(data: BCPdfData): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Bon de commande ${data.bcNumber}`);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page: PDFPage = doc.addPage(PAGE);
  const width = PAGE[0] - 2 * MARGIN;
  let y = PAGE[1] - MARGIN;

  const text = (
    s: string,
    x: number,
    opts: {
      f?: PDFFont;
      size?: number;
      color?: typeof BLACK;
      right?: boolean;
    } = {},
  ) => {
    const f = opts.f ?? font;
    const size = opts.size ?? FONT_SIZE;
    const clean = toWinAnsi(s);
    const dx = opts.right ? f.widthOfTextAtSize(clean, size) : 0;
    page.drawText(clean, {
      x: x - dx,
      y,
      size,
      font: f,
      color: opts.color ?? BLACK,
    });
  };

  // ── Header ────────────────────────────────────────────────────────────
  text(BC_ISSUER.name, MARGIN, { f: bold, size: 14 });
  text('BON DE COMMANDE', MARGIN + width, { f: bold, size: 16, right: true });
  y -= 18;
  for (const l of BC_ISSUER.lines) {
    text(l, MARGIN, { color: GREY });
    y -= LINE;
  }
  text(`N° ${data.bcNumber}`, MARGIN + width, {
    f: bold,
    size: 10,
    right: true,
  });
  y -= LINE;
  text(`Date : ${data.date.toLocaleDateString('fr-FR')}`, MARGIN + width, {
    right: true,
  });
  y -= LINE;
  text(`DA : ${data.purchaseReference}`, MARGIN + width, { right: true });
  y -= LINE * 2;

  // ── Supplier block ────────────────────────────────────────────────────
  const s = data.supplier;
  const supplierLines = [
    s.address,
    s.nif && `NIF : ${s.nif}`,
    s.stat && `STAT : ${s.stat}`,
    s.phone && `Tél : ${s.phone}`,
    s.email,
  ].filter(Boolean) as string[];
  const boxH = 30 + supplierLines.length * LINE;
  const boxX = MARGIN + width / 2;
  page.drawRectangle({
    x: boxX,
    y: y - boxH + LINE,
    width: width / 2,
    height: boxH,
    borderColor: GREY,
    borderWidth: 0.5,
  });
  const yTop = y;
  text('Fournisseur', boxX + 8, { color: GREY });
  y -= LINE;
  text(s.name, boxX + 8, { f: bold, size: 10 });
  y -= LINE;
  for (const l of supplierLines) {
    text(l, boxX + 8);
    y -= LINE;
  }
  y = yTop;
  text('Objet', MARGIN, { color: GREY });
  y -= LINE;
  for (const l of wrap(data.purchaseTitle, bold, 10, width / 2 - 16)) {
    text(l, MARGIN, { f: bold, size: 10 });
    y -= LINE;
  }
  y = Math.min(y, yTop - boxH) - LINE * 2;

  // ── Items table ───────────────────────────────────────────────────────
  // columns: N° | Désignation | Qté | PU | Montant
  const cols = [25, width - 25 - 50 - 90 - 95, 50, 90, 95];
  const xs = cols.reduce<number[]>(
    (acc, w, i) => [...acc, (acc[i - 1] ?? MARGIN) + (i ? cols[i - 1] : 0)],
    [],
  );
  const headerRow = () => {
    page.drawRectangle({
      x: MARGIN,
      y: y - 4,
      width,
      height: LINE + 4,
      color: LIGHT,
    });
    text('N°', xs[0] + 3, { f: bold });
    text('Désignation', xs[1] + 3, { f: bold });
    text('Qté', xs[2] + cols[2] - 3, { f: bold, right: true });
    text('PU (Ar)', xs[3] + cols[3] - 3, { f: bold, right: true });
    text('Montant (Ar)', xs[4] + cols[4] - 3, { f: bold, right: true });
    y -= LINE + 6;
  };
  headerRow();

  let total = 0;
  data.items.forEach((item, i) => {
    const lines = wrap(item.designation, font, FONT_SIZE, cols[1] - 6);
    if (y - lines.length * LINE < MARGIN + 140) {
      page = doc.addPage(PAGE);
      y = PAGE[1] - MARGIN;
      headerRow();
    }
    text(String(i + 1), xs[0] + 3);
    text(formatAmount(item.quantity), xs[2] + cols[2] - 3, { right: true });
    text(formatAmount(item.unitPrice), xs[3] + cols[3] - 3, { right: true });
    text(formatAmount(item.amount), xs[4] + cols[4] - 3, { right: true });
    for (const l of lines) {
      text(l, xs[1] + 3);
      y -= LINE;
    }
    y -= 3;
    page.drawLine({
      start: { x: MARGIN, y: y + 6 },
      end: { x: MARGIN + width, y: y + 6 },
      thickness: 0.3,
      color: GREY,
    });
    total += Number(item.amount) || 0;
  });

  y -= 6;
  text('TOTAL (Ar)', xs[3] + cols[3] - 3, { f: bold, size: 10, right: true });
  text(formatAmount(total), xs[4] + cols[4] - 3, {
    f: bold,
    size: 10,
    right: true,
  });
  y -= LINE * 4;

  // ── Signatures ────────────────────────────────────────────────────────
  if (y < MARGIN + 80) {
    page = doc.addPage(PAGE);
    y = PAGE[1] - MARGIN;
  }
  text("L'Acheteur", MARGIN, { f: bold });
  text('Le Fournisseur', MARGIN + width, { f: bold, right: true });
  y -= LINE;
  if (data.buyerName) text(data.buyerName, MARGIN, { color: GREY });

  return Buffer.from(await doc.save());
}

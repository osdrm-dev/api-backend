import { PDFDocument } from 'pdf-lib';
import { buildBCPdf, formatAmount, toWinAnsi } from './bc-pdf.builder';

describe('bc-pdf.builder', () => {
  it('formats amounts with space thousands separators', () => {
    expect(formatAmount(1234567)).toBe('1 234 567');
    expect(formatAmount(1234.5)).toBe('1 234,50');
  });

  it('maps non-WinAnsi characters instead of throwing', () => {
    expect(toWinAnsi('a\u202fb ’c’ 漢')).toBe("a b 'c' ?");
  });

  it('builds a valid multi-page PDF with accents and long designations', async () => {
    const items = Array.from({ length: 60 }, (_, i) => ({
      designation: `Écran 27’’ réf. ${i} ${'x'.repeat(i % 3 ? 10 : 200)}`,
      quantity: 2,
      unitPrice: 150000,
      amount: 300000,
    }));
    const buffer = await buildBCPdf({
      bcNumber: 'BC-DA-2026-0001',
      date: new Date('2026-11-19'),
      purchaseReference: 'DA-2026-0001',
      purchaseTitle: 'Achat matériel informatique',
      buyerName: 'Acheteur',
      supplier: { name: 'Fournisseur Ç', nif: '123', stat: null },
      items,
    });
    const pdf = await PDFDocument.load(buffer);
    expect(pdf.getPageCount()).toBeGreaterThan(1);
  });
});

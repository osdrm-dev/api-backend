import { BadRequestException } from '@nestjs/common';
import { parseSupplierCsv } from './supplier-csv-parser.util';

const HEADER = [
  'CATEGORIE',
  'FOURNISSEUR',
  'ADRESSE',
  'VILLE',
  'PAYS',
  'CONTACT / NOM',
  'FONCTION',
  "N° CARTE D'IDENTITE NATIONALE",
  'LANGUES',
  'ADRESSE MAIL',
  'TELEPHONE  / MOBILE',
  'SITE INTERNET',
  'PIECES JUSTIFICATIVES ADMINISTRATIVES A FOURNIR',
  'REMARQUES',
  'Date du dernier achat',
  'Respect des délais',
];

// Export CSV d'Excel FR : cartouche au-dessus des en-têtes, séparateur « ; ».
const csv = (rows: string[][], sep = ';') =>
  [
    ';;Liste de fournisseurs;;;;;;;;;;;;;',
    ';;;;Operations Manager;;Faniry;;;Pays;Madagascar',
    '',
    HEADER.join(sep),
    ...rows.map((r) =>
      r
        .map((c) => (/[;,"\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c))
        .join(sep),
    ),
  ].join('\r\n');

const abc = [
  'Construction et réhabilitation',
  'ABC ',
  'Enceinte La City Ivandry',
  'Antananarivo',
  'Madagascar',
  'Lahatra Najaina',
  'Commercial',
  'NIF 10 000 22 111\nSTAT 24101 11 2000 0 10023',
  'Français / Malagasy',
  'ABC <contact@abc.mg>',
  '+261 20 22 499 00',
  'www.abc.mg',
  '',
  'Livre vite',
  '',
  'Bon',
];

describe('parseSupplierCsv', () => {
  it('finds the header row below the title block and maps the columns', () => {
    const { rows } = parseSupplierCsv(Buffer.from(csv([abc]), 'utf8'));
    expect(rows).toEqual([
      {
        line: 5,
        name: 'ABC',
        category: 'Construction et réhabilitation',
        address: 'Enceinte La City Ivandry',
        city: 'Antananarivo',
        country: 'Madagascar',
        contactName: 'Lahatra Najaina',
        contactPosition: 'Commercial',
        nif: '1000022111',
        stat: '24101112000010023',
        languages: 'Français / Malagasy',
        email: 'contact@abc.mg',
        phone: '+261 20 22 499 00',
        website: 'www.abc.mg',
        notes: 'Livre vite',
      },
    ]);
  });

  it('decodes a Windows-1252 file (Excel FR "CSV (séparateur: point-virgule)")', () => {
    const buf = Buffer.from(csv([abc]), 'latin1');
    expect(parseSupplierCsv(buf).rows[0].category).toBe(
      'Construction et réhabilitation',
    );
  });

  it('accepts a comma separated file', () => {
    expect(parseSupplierCsv(Buffer.from(csv([abc], ','))).rows).toHaveLength(1);
  });

  it('keeps an identity value that is not NIF/STAT in the notes', () => {
    const row = [...abc];
    row[7] = 'CIN 101 211 000 111';
    row[13] = '';
    const { rows } = parseSupplierCsv(Buffer.from(csv([row])));
    expect(rows[0].nif).toBeUndefined();
    expect(rows[0].notes).toBe("Pièce d'identité : CIN 101 211 000 111");
  });

  it('ignores rows without supplier name and reports in-file duplicates', () => {
    const empty = abc.map(() => '');
    const dupByName = [...abc];
    dupByName[7] = '';
    const { rows, skipped } = parseSupplierCsv(
      Buffer.from(csv([abc, empty, dupByName])),
    );
    expect(rows.map((r) => r.line)).toEqual([5]);
    expect(skipped).toEqual([
      { line: 7, name: 'ABC', reason: 'Doublon dans le fichier' },
    ]);
  });

  it('maps the KBIS / chambre de commerce column to rcs (onglet potentiel)', () => {
    const text =
      'FOURNISSEUR;N° KBISS ou N° ENREGRISTREMENT CHAMBRE DE COMMERCE\nOXXAN;RCS 2016 B 001';
    expect(parseSupplierCsv(Buffer.from(text)).rows[0].rcs).toBe(
      'RCS 2016 B 001',
    );
  });

  it('rejects a file without a FOURNISSEUR column', () => {
    expect(() => parseSupplierCsv(Buffer.from('nom;ville\nA;B'))).toThrow(
      BadRequestException,
    );
  });
});

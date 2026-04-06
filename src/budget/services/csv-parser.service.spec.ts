import { BadRequestException } from '@nestjs/common';
import { CsvParserService } from './csv-parser.service';

describe('CsvParserService', () => {
  let service: CsvParserService;

  beforeEach(() => {
    service = new CsvParserService();
  });

  const header =
    'nom_projet,code_projet,code_subvention,code_activite,centre_cout,region,site,seuil_budgetaire';

  it('parses a valid CSV', () => {
    const csv = [
      header,
      'Dev rural,PROJ-001,GRANT-1,ACT-1,CC-1,Analamanga,Antananarivo,5000000',
      'Sante,PROJ-002,GRANT-2,ACT-2,CC-2,Boeny,Mahajanga,7500000.50',
    ].join('\n');
    const result = service.parseBudgetCsv(Buffer.from(csv));
    expect(result).toHaveLength(2);
    expect(result[0].projectCode).toBe('PROJ-001');
    expect(result[0].budgetThreshold).toBe(5000000);
    expect(result[1].budgetThreshold).toBe(7500000.5);
  });

  it('throws on missing required columns', () => {
    const csv = ['nom_projet,code_projet', 'Foo,PROJ-001'].join('\n');
    expect(() => service.parseBudgetCsv(Buffer.from(csv))).toThrow(
      BadRequestException,
    );
  });

  it('throws on duplicate project codes', () => {
    const csv = [
      header,
      'Foo,PROJ-001,G,A,C,R,S,1000',
      'Bar,PROJ-001,G,A,C,R,S,2000',
    ].join('\n');
    expect(() => service.parseBudgetCsv(Buffer.from(csv))).toThrow(/doublon/i);
  });

  it('throws on invalid threshold', () => {
    const csv = [header, 'Foo,PROJ-001,G,A,C,R,S,not-a-number'].join('\n');
    expect(() => service.parseBudgetCsv(Buffer.from(csv))).toThrow(
      /seuil_budgetaire/,
    );
  });

  it('skips empty rows silently', () => {
    const csv = [
      header,
      'Foo,PROJ-001,G,A,C,R,S,1000',
      ',,,,,,,',
      'Bar,PROJ-002,G,A,C,R,S,2000',
    ].join('\n');
    const result = service.parseBudgetCsv(Buffer.from(csv));
    expect(result).toHaveLength(2);
  });

  it('throws on empty file', () => {
    expect(() => service.parseBudgetCsv(Buffer.from(''))).toThrow(
      BadRequestException,
    );
  });

  it('ignores extra columns', () => {
    const csv = [header + ',extra', 'Foo,PROJ-001,G,A,C,R,S,1000,ignored'].join(
      '\n',
    );
    const result = service.parseBudgetCsv(Buffer.from(csv));
    expect(result).toHaveLength(1);
  });
});

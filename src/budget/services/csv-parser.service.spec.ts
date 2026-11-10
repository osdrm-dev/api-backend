import { ErrorCode } from 'src/common/errors';
import { CsvParserService } from './csv-parser.service';

const expectCode = (fn: () => unknown, code: string) => {
  try {
    fn();
  } catch (err) {
    expect((err as { code?: string }).code).toBe(code);
    return;
  }
  throw new Error('Expected function to throw');
};

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
    expectCode(
      () => service.parseBudgetCsv(Buffer.from(csv)),
      ErrorCode.BUDGET_CSV_COLUMNS_MISSING,
    );
  });

  it('throws on duplicate activity codes', () => {
    const csv = [
      header,
      'Foo,PROJ-001,G,ACT-1,C,R,S,1000',
      'Bar,PROJ-002,G,ACT-1,C,R,S,2000',
    ].join('\n');
    expectCode(
      () => service.parseBudgetCsv(Buffer.from(csv)),
      ErrorCode.BUDGET_CSV_DUPLICATE_ACTIVITY_CODES,
    );
  });

  it('allows the same project code with different activity codes', () => {
    const csv = [
      header,
      'Foo,PROJ-001,G,ACT-1,C,R,S,1000',
      'Foo,PROJ-001,G,ACT-2,C,R,S,2000',
    ].join('\n');
    const result = service.parseBudgetCsv(Buffer.from(csv));
    expect(result).toHaveLength(2);
  });

  it('throws on invalid threshold', () => {
    const csv = [header, 'Foo,PROJ-001,G,A,C,R,S,not-a-number'].join('\n');
    expectCode(
      () => service.parseBudgetCsv(Buffer.from(csv)),
      ErrorCode.BUDGET_CSV_ROW_THRESHOLD_INVALID,
    );
  });

  it('skips empty rows silently', () => {
    const csv = [
      header,
      'Foo,PROJ-001,G,ACT-1,C,R,S,1000',
      ',,,,,,,',
      'Bar,PROJ-002,G,ACT-2,C,R,S,2000',
    ].join('\n');
    const result = service.parseBudgetCsv(Buffer.from(csv));
    expect(result).toHaveLength(2);
  });

  it('throws on empty file', () => {
    expectCode(
      () => service.parseBudgetCsv(Buffer.from('')),
      ErrorCode.BUDGET_CSV_EMPTY,
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

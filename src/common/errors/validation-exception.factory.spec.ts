import { ValidationError } from 'class-validator';
import { validationExceptionFactory } from './validation-exception.factory';

describe('validationExceptionFactory', () => {
  it('flattens top-level errors', () => {
    const ex = validationExceptionFactory([
      {
        property: 'status',
        constraints: { isNotEmpty: 'status should not be empty' },
        children: [],
      } as ValidationError,
    ]);
    expect(ex.getStatus()).toBe(400);
    expect(ex.code).toBe('VALIDATION_FAILED');
    expect(ex.fields).toEqual([{ field: 'status', code: 'isNotEmpty' }]);
    expect(ex.message).toBe('Validation failed: status isNotEmpty');
  });

  it('flattens nested array errors to dot paths', () => {
    const ex = validationExceptionFactory([
      {
        property: 'items',
        children: [
          {
            property: '0',
            children: [
              {
                property: 'quantity',
                constraints: { isPositive: '...' },
                children: [],
              },
            ],
          },
        ],
      } as any,
    ]);
    expect(ex.fields).toEqual([
      { field: 'items.0.quantity', code: 'isPositive' },
    ]);
  });

  it('uses the first constraint per property', () => {
    const ex = validationExceptionFactory([
      {
        property: 'name',
        constraints: { isNotEmpty: 'a', isString: 'b' },
        children: [],
      } as ValidationError,
    ]);
    expect(ex.fields).toEqual([{ field: 'name', code: 'isNotEmpty' }]);
  });
});

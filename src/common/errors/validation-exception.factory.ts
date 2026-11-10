import { HttpStatus } from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { AppException, FieldError } from './app.exception';
import { ErrorCode } from './error-codes';

function flatten(errors: ValidationError[], prefix = ''): FieldError[] {
  return errors.flatMap((e) => {
    const path = prefix ? `${prefix}.${e.property}` : e.property;
    const first = Object.keys(e.constraints ?? {})[0];
    return [
      ...(first ? [{ field: path, code: first }] : []),
      ...flatten(e.children ?? [], path),
    ];
  });
}

export function validationExceptionFactory(
  errors: ValidationError[],
): AppException {
  const fields = flatten(errors);
  const summary = fields.map((f) => `${f.field} ${f.code}`).join(', ');
  return new AppException(
    HttpStatus.BAD_REQUEST,
    ErrorCode.VALIDATION_FAILED,
    `Validation failed: ${summary}`,
    { fields },
  );
}

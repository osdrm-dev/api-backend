import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from './error-codes';

export type FieldError = { field: string; code: string };
export type ErrorParams = Record<string, string | number>;

export class AppException extends HttpException {
  readonly code: ErrorCode;
  readonly fields?: FieldError[];
  readonly params?: ErrorParams;

  constructor(
    status: HttpStatus,
    code: ErrorCode,
    message: string,
    options?: { fields?: FieldError[]; params?: ErrorParams },
  ) {
    super(
      {
        statusCode: status,
        code,
        message,
        fields: options?.fields,
        params: options?.params,
      },
      status,
    );
    this.code = code;
    this.fields = options?.fields;
    this.params = options?.params;
  }
}

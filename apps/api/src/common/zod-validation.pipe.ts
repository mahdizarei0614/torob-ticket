import { BadRequestException, type PipeTransform } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { z } from 'zod';
import type { ApiError } from '@torob-ticket/contracts';

export interface ZodValidationOptions {
  /** Later request-scoped integration may resolve the current correlation ID. */
  requestId?: string | (() => string);
}

/** Install at command boundaries; parsed values (including normalization) win. */
export class ZodValidationPipe<Schema extends z.ZodType> implements PipeTransform<unknown, z.output<Schema>> {
  constructor(private readonly schema: Schema, private readonly options: ZodValidationOptions = {}) {}

  transform(value: unknown): z.output<Schema> {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;
    const fieldPaths = result.error.issues.flatMap(issue => {
      const path = issue.path.map(part => typeof part === 'number' ? part : String(part));
      // Zod reports unknown keys at their parent. Expose each offending field,
      // without echoing values or framework/library-specific prose to clients.
      return issue.code === 'unrecognized_keys' ? issue.keys.map(key => [...path, key]) : [path];
    });
    const correlation = typeof this.options.requestId === 'function' ? this.options.requestId() : this.options.requestId;
    const error: ApiError = {
      code: 'INVALID_QUERY',
      fieldPaths: [...new Map(fieldPaths.map(path => [JSON.stringify(path), path])).values()],
      retryable: false,
      requestId: correlation?.trim() || randomUUID(),
    };
    throw new BadRequestException(error);
  }
}

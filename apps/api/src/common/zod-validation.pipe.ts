import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { ZodSchema } from 'zod';

/** Validates + narrows a request payload against a Zod schema. Use as @Body(new ZodValidationPipe(schema)). */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown): unknown {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: result.error.flatten(),
      });
    }
    return result.data;
  }
}

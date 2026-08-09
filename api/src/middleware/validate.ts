import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError, type ZodSchema } from 'zod';

import { ApiError } from '../utils/ApiError.js';

type RequestPart = 'body' | 'query' | 'params';

export function validate(schema: ZodSchema, part: RequestPart = 'body'): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      req[part] = schema.parse(req[part]);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(
          new ApiError(400, 'VALIDATION_ERROR', 'Geçersiz istek verisi', error.flatten().fieldErrors),
        );
        return;
      }
      next(error);
    }
  };
}

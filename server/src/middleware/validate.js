import mongoose from 'mongoose';
import { ApiError } from '../utils/ApiError.js';

/**
 * Parses req[source] with a zod schema and replaces it with the parsed
 * (coerced, stripped) value. ZodErrors are turned into 400s by the error handler.
 */
export const validate =
  (schema, source = 'body') =>
  (req, _res, next) => {
    try {
      const parsed = schema.parse(req[source] ?? {});
      if (source === 'query') {
        // req.query is a getter in some Express setups; keep the parsed copy separately.
        req.validatedQuery = parsed;
      } else {
        req[source] = parsed;
      }
      next();
    } catch (err) {
      next(err);
    }
  };

export const validateObjectId =
  (...params) =>
  (req, _res, next) => {
    for (const p of params) {
      if (!mongoose.isValidObjectId(req.params[p])) {
        return next(ApiError.badRequest(`Invalid ${p}`));
      }
    }
    next();
  };

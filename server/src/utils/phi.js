import { ApiError } from './ApiError.js';
import { findPrivacyIssues, privacyMessage } from './privacy.js';

/**
 * Refuses text that could identify a patient or asks for a patient's identity (see privacy.js).
 * A safety net that catches common patterns - not a substitute for the poster's own de-identification.
 * Accepts strings, arrays and objects (a case study's fields), checking every string inside.
 */
export function assertNoObviousPHI(...values) {
  const texts = [];
  const collect = (v) => {
    if (typeof v === 'string') texts.push(v);
    else if (Array.isArray(v)) v.forEach(collect);
    else if (v && typeof v === 'object') Object.values(v).forEach(collect);
  };
  values.forEach(collect);
  for (const text of texts) {
    const [issue] = findPrivacyIssues(text);
    if (issue) throw new ApiError(422, `Privacy check: ${privacyMessage(issue)}`);
  }
}

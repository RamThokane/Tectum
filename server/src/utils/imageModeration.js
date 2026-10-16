import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { env } from '../config/env.js';

/**
 * AI review of post images before they are published.
 *
 * Every image is classified by Claude for:
 *  - sensitive: graphic clinical content -> the post is blurred automatically
 *  - identifiers: visible patient-identifying details -> blurred + sent to moderators
 *  - inappropriate: explicit/violent content unrelated to medicine -> blurred + sent to moderators
 *
 * Fail-safe: if the AI can't review an image (error, refusal, too large), the images are
 * blurred anyway. Without an API key, review is skipped and the poster's own toggle applies.
 */

const MODEL = 'claude-opus-5';
const MAX_API_IMAGE_BYTES = 5 * 1024 * 1024; // Claude's per-image limit
const MEDIA_TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp' };

const client = env.anthropicApiKey ? new Anthropic({ apiKey: env.anthropicApiKey, timeout: 60_000, maxRetries: 2 }) : null;
export const aiModerationEnabled = Boolean(client);

const ReviewSchema = z.object({
  images: z.array(
    z.object({
      index: z.number(),
      sensitive: z.boolean(),
      identifiers: z.boolean(),
      inappropriate: z.boolean(),
      reason: z.string(),
    })
  ),
});

const SYSTEM = `You review images uploaded to Tectum, a professional social network where doctors, nurses, researchers and medical students share clinical case studies and study notes. Your job is to decide, for each image, whether it must be blurred before other members see it and whether moderators need to look at it.

For each image, answer three questions:

1. sensitive - Would a typical member reasonably want a warning before seeing it? True for graphic clinical imagery: open wounds, blood, surgical or procedural fields, trauma, burns, amputations, severe skin or soft-tissue disease, gross deformity, necrosis, deceased patients, childbirth, and nudity or genitalia/breasts shown in a clinical context. False for radiology (X-ray, CT, MRI, ultrasound), ECGs, microscopy and pathology slides, lab results, charts, diagrams, drawings, text, equipment and ordinary photos.

2. identifiers - Could this image identify a real patient? True if it shows a recognisable face, or readable patient names, dates of birth, record/MRN/ID numbers, addresses, or wristbands/labels with personal details (including text burned into scans). Distinctive tattoos also count. Anonymised or cropped images are fine.

3. inappropriate - Is it explicit sexual content, gratuitous violence, or otherwise clearly unrelated to medical education?

Give a short reason (under 20 words) describing what you see, without repeating any personal details. When unsure about "sensitive", prefer true - blurring a borderline image costs little.`;

/**
 * @param {Array<{originalname: string, buffer: Buffer, size: number}>} files multer image files
 * @returns {Promise<{status: 'clear'|'sensitive'|'flagged'|'unverified'|'skipped', blur: boolean, flag: boolean, reasons: string[], model?: string}>}
 */
export async function reviewImages(files) {
  if (!files.length) return { status: 'clear', blur: false, flag: false, reasons: [] };
  if (!client) return { status: 'skipped', blur: false, flag: false, reasons: [] };

  // Images Claude can't accept are treated as unreviewed (and therefore blurred).
  const reviewable = files.filter((f) => f.size <= MAX_API_IMAGE_BYTES && MEDIA_TYPES[path.extname(f.originalname).toLowerCase()]);
  if (reviewable.length < files.length) {
    return { status: 'unverified', blur: true, flag: false, reasons: ['Image too large for automatic review'] };
  }

  const content = [];
  files.forEach((f, i) => {
    content.push({ type: 'text', text: `Image ${i}:` });
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: MEDIA_TYPES[path.extname(f.originalname).toLowerCase()], data: f.buffer.toString('base64') },
    });
  });
  content.push({ type: 'text', text: `Review each of the ${files.length} image(s) above.` });

  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 4096,
      output_config: { effort: 'low', format: zodOutputFormat(ReviewSchema) },
      system: SYSTEM,
      messages: [{ role: 'user', content }],
    });

    // A refusal or unparseable answer means we couldn't clear the images: blur and ask a human.
    if (response.stop_reason === 'refusal' || !response.parsed_output) {
      return { status: 'flagged', blur: true, flag: true, reasons: ['AI review could not clear these images'], model: MODEL };
    }

    const results = response.parsed_output.images;
    // Every image must be covered; anything missing counts as unreviewed.
    const covered = new Set(results.map((r) => r.index));
    const missing = files.some((_, i) => !covered.has(i));

    const sensitive = missing || results.some((r) => r.sensitive);
    const flag = results.some((r) => r.identifiers || r.inappropriate);
    const reasons = results
      .filter((r) => r.sensitive || r.identifiers || r.inappropriate)
      .map((r) => {
        const tags = [r.sensitive && 'sensitive', r.identifiers && 'possible patient identifiers', r.inappropriate && 'inappropriate'].filter(Boolean);
        return `Image ${r.index + 1} (${tags.join(', ')}): ${r.reason}`;
      });

    return {
      status: flag ? 'flagged' : sensitive ? 'sensitive' : 'clear',
      blur: sensitive || flag,
      flag,
      reasons,
      model: MODEL,
    };
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      console.error('[ai-moderation] Invalid ANTHROPIC_API_KEY - images will be blurred until this is fixed');
    } else if (err instanceof Anthropic.RateLimitError) {
      console.error('[ai-moderation] Rate limited by the Claude API');
    } else if (err instanceof Anthropic.APIError) {
      console.error(`[ai-moderation] Claude API error ${err.status}: ${err.message}`);
    } else {
      console.error('[ai-moderation] Review failed:', err.message);
    }
    return { status: 'unverified', blur: true, flag: false, reasons: ['Automatic review unavailable'] };
  }
}

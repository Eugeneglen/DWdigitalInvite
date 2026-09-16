/**
 * Hero Focal Point Detection — server-only.
 *
 * Problem it solves: couples upload landscape portraits; the mobile hero view
 * is ~9:16. `object-cover` + `object-center` (the legacy render) centre-crops
 * and can cut off one partner. These helpers find the couple's joint centroid
 * so the render can anchor `object-position` on BOTH people ("never split the
 * couple").
 *
 * ZERO-REGRESSION CONTRACT:
 *   - detectHeroFocal() NEVER throws. Any failure (SDK missing, timeout,
 *     unparsable response) returns null → caller keeps legacy centre crop.
 *   - Detection runs AFTER the file is stored, so an upload can never fail
 *     because of it.
 *   - Returns normalised 0..1 coordinates; consumers must clamp before use.
 */

const DETECTION_TIMEOUT_MS = 15_000;

export interface HeroFocal {
  x: number; // 0..1 horizontal centroid of all detected people
  y: number; // 0..1 vertical centroid of all detected people
  confidence: 'high' | 'medium' | 'low';
}

/** Clamp any coordinate into [0,1] — used by both API parsing and client drag. */
export function clampFocal(value: number): number {
  if (Number.isNaN(value) || !Number.isFinite(value)) return 0.5;
  return Math.min(1, Math.max(0, value));
}

/** Valid display modes. null/'fill' (or anything else) → legacy full-bleed crop. */
export type HeroDisplayMode = 'fill' | 'fit';

export function normalizeDisplayMode(value: unknown): HeroDisplayMode | null {
  if (typeof value !== 'string') return null;
  const v = value.trim().toLowerCase();
  if (v === 'fit') return 'fit';
  if (v === 'fill') return 'fill';
  return null; // unknown → legacy
}

/**
 * Extract the first JSON object from a model response.
 * Models sometimes wrap JSON in ```fences``` or prose — tolerate that.
 */
function extractJsonObject(text: string): Record<string, unknown> | null {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1));
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function parseFocalFromResponse(text: string): HeroFocal | null {
  const obj = extractJsonObject(text);
  if (!obj) return null;

  const x = Number(obj.x);
  const y = Number(obj.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  const rawConf = typeof obj.confidence === 'string' ? obj.confidence.toLowerCase() : '';
  const confidence: HeroFocal['confidence'] =
    rawConf.includes('high') ? 'high' : rawConf.includes('medium') ? 'medium' : 'low';

  return {
    x: clampFocal(x),
    y: clampFocal(y),
    confidence,
  };
}

const PROMPT = [
  'You are a precise image-composition analyser for a wedding website hero banner.',
  'Locate every PERSON fully or partially visible in this image (bride, groom, and any others).',
  'Compute the CENTROID (average centre point) of the union bounding box that contains ALL detected people — not a single face, so no one is excluded.',
  'Coordinates are normalised: (0,0) is the top-left corner of the image, (1,1) is the bottom-right.',
  'If NO people are visible, centre on the main subject instead.',
  'Reply with ONLY this JSON object, no other text:',
  '{"x": <number 0..1>, "y": <number 0..1>, "confidence": "high"|"medium"|"low"}',
  'Use "high" when people are clearly visible, "medium" when partially visible or uncertain, "low" when no people were found.',
].join(' ');

/**
 * Detect the couple's joint focal point in a hero image.
 *
 * @param imageBuffer JPEG/PNG bytes of the (already sharp-optimised) hero image.
 * @param mimeType    Image MIME type, used for the data URL prefix.
 * @returns Focal point, or null on ANY failure — never throws, never blocks.
 */
export async function detectHeroFocal(
  imageBuffer: Buffer,
  mimeType: string = 'image/jpeg',
): Promise<HeroFocal | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // Lazy import keeps startup cheap and isolates SDK failures to call time.
    const { default: ZAI } = await import('z-ai-web-dev-sdk');
    const zai = await ZAI.create();

    const mime = mimeType.startsWith('image/') ? mimeType : 'image/jpeg';
    const base64 = imageBuffer.toString('base64');

    const request = zai.chat.completions.createVision({
      // NOTE: the SDK's TS types mark `model` as required, but the documented
      // VLM usage omits it (the endpoint defaults the model). Omitting it is
      // live-verified: hero uploads return real focal coordinates.
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: PROMPT },
            {
              type: 'image_url',
              image_url: { url: `data:${mime};base64,${base64}` },
            },
          ],
        },
      ],
      thinking: { type: 'disabled' },
    });

    const response = await Promise.race([
      request,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('focal detection timeout')), DETECTION_TIMEOUT_MS);
      }),
    ]);

    const content = response?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') return null;

    return parseFocalFromResponse(content);
  } catch (error) {
    // Contract: never throw. Log for observability, return legacy fallback.
    console.warn(
      '[hero-focal] detection unavailable, falling back to centre crop:',
      error instanceof Error ? error.message : String(error),
    );
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

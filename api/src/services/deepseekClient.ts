import { env } from '../config/env.js';

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';
const RETRY_DELAY_MS = 1_000;

export class DeepseekError extends Error {
  constructor(message: string, readonly retryable = false) {
    super(message);
    this.name = 'DeepseekError';
  }
}

export function isDeepseekConfigured() {
  return Boolean(env.deepseekApiKey);
}

/**
 * Removes halves of surrogate pairs: a text cut in the middle of an emoji serializes to an unpaired \ud83d,
 * which DeepSeek rejects with 400 «unexpected end of hex escape».
 */
export function wellFormed(text: string) {
  return text.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '');
}

async function request(system: string, user: string) {
  let response: Response;
  try {
    response = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.deepseekApiKey}` },
      body: JSON.stringify({
        model: env.deepseekModel,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: wellFormed(system) }, { role: 'user', content: wellFormed(user) }]
      }),
      signal: AbortSignal.timeout(env.deepseekTimeoutMs)
    });
  } catch (error) {
    const cause = (error as { cause?: { code?: string } }).cause?.code;
    throw new DeepseekError(`${error instanceof Error ? error.message : 'DeepSeek request failed'}${cause ? ` (${cause})` : ''}`, true);
  }
  if (!response.ok) {
    const body = (await response.text().catch(() => '')).slice(0, 200);
    throw new DeepseekError(`DeepSeek HTTP ${response.status}: ${body}`, response.status === 429 || response.status >= 500);
  }
  return response;
}

/** One JSON-mode chat completion. Network errors, 429 and 5xx are retried once; then a DeepseekError is thrown. */
export async function deepseekJson(system: string, user: string): Promise<{ data: unknown; tokens: number; ms: number }> {
  if (!env.deepseekApiKey) throw new DeepseekError('DEEPSEEK_API_KEY is not set');
  const started = Date.now();
  let response: Response;
  try {
    response = await request(system, user);
  } catch (error) {
    if (!(error instanceof DeepseekError && error.retryable)) throw error;
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    response = await request(system, user);
  }
  const payload = await response.json().catch(() => null) as { choices?: Array<{ message?: { content?: string } }>; usage?: { total_tokens?: number } } | null;
  const content = payload?.choices?.[0]?.message?.content;
  if (!content) throw new DeepseekError('DeepSeek returned an empty answer');
  try {
    return { data: JSON.parse(content), tokens: payload?.usage?.total_tokens ?? 0, ms: Date.now() - started };
  } catch {
    throw new DeepseekError('DeepSeek returned invalid JSON');
  }
}

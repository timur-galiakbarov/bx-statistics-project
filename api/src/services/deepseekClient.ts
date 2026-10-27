import { env } from '../config/env.js';

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';

export class DeepseekError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DeepseekError';
  }
}

export function isDeepseekConfigured() {
  return Boolean(env.deepseekApiKey);
}

/** One JSON-mode chat completion. Throws DeepseekError on timeout, HTTP errors and unparsable answers. */
export async function deepseekJson(system: string, user: string): Promise<{ data: unknown; tokens: number; ms: number }> {
  if (!env.deepseekApiKey) throw new DeepseekError('DEEPSEEK_API_KEY is not set');
  const started = Date.now();
  let response: Response;
  try {
    response = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.deepseekApiKey}` },
      body: JSON.stringify({
        model: env.deepseekModel,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }]
      }),
      signal: AbortSignal.timeout(env.deepseekTimeoutMs)
    });
  } catch (error) {
    throw new DeepseekError(error instanceof Error ? error.message : 'DeepSeek request failed');
  }
  if (!response.ok) throw new DeepseekError(`DeepSeek HTTP ${response.status}`);
  const payload = await response.json().catch(() => null) as { choices?: Array<{ message?: { content?: string } }>; usage?: { total_tokens?: number } } | null;
  const content = payload?.choices?.[0]?.message?.content;
  if (!content) throw new DeepseekError('DeepSeek returned an empty answer');
  try {
    return { data: JSON.parse(content), tokens: payload?.usage?.total_tokens ?? 0, ms: Date.now() - started };
  } catch {
    throw new DeepseekError('DeepSeek returned invalid JSON');
  }
}

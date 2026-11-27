import { request as httpsRequest } from 'node:https';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { getTelegramProxy } from './telegramProxy.js';

// OpenAI использует тот же выход в сеть, что и Telegram, включая DNS через прокси.
export async function requestOpenAi(
  path: '/v1/responses' | '/v1/images/generations' | '/v1/images/edits',
  apiKey: string,
  payload: Record<string, unknown>,
  timeoutMs: number
) {
  const proxy = getTelegramProxy();
  let agent: SocksProxyAgent | undefined;
  if (proxy) {
    if (!('socksType' in proxy)) throw new Error('OpenAI requires a SOCKS proxy');
    const url = new URL(`${proxy.socksType === 4 ? 'socks4a' : 'socks5h'}://localhost`);
    url.hostname = proxy.ip;
    url.port = String(proxy.port);
    url.username = proxy.username ?? '';
    url.password = proxy.password ?? '';
    agent = new SocksProxyAgent(url, { timeout: timeoutMs });
  }

  const body = JSON.stringify(payload);
  try {
    return await new Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>((resolve, reject) => {
      const req = httpsRequest({
        hostname: 'api.openai.com',
        path,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        },
        agent,
        signal: AbortSignal.timeout(timeoutMs)
      }, (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        response.on('error', reject);
        response.on('aborted', () => reject(new Error('OpenAI response interrupted')));
        response.on('end', () => {
          const status = response.statusCode ?? 0;
          const text = Buffer.concat(chunks).toString('utf8');
          resolve({ ok: status >= 200 && status < 300, status, json: async () => JSON.parse(text) });
        });
      });
      req.on('error', reject);
      req.end(body);
    });
  } finally {
    agent?.destroy();
  }
}

import assert from 'node:assert/strict';
import { createServer, type Socket } from 'node:net';
import test, { type TestContext } from 'node:test';
import { env } from '../config/env.js';
import { requestOpenAi } from './openAiClient.js';

async function withProxy(t: TestContext, onConnection: (socket: Socket) => void) {
  const previous = {
    telegramProxyHost: env.telegramProxyHost,
    telegramProxyPort: env.telegramProxyPort,
    telegramProxyType: env.telegramProxyType,
    telegramProxyUsername: env.telegramProxyUsername,
    telegramProxyPassword: env.telegramProxyPassword
  };
  const sockets = new Set<Socket>();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on('error', () => undefined);
    socket.on('close', () => sockets.delete(socket));
    onConnection(socket);
  });
  t.after(async () => {
    Object.assign(env, previous);
    for (const socket of sockets) socket.destroy();
    if (server.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  Object.assign(env, {
    telegramProxyHost: '127.0.0.1',
    telegramProxyPort: address.port,
    telegramProxyType: 5,
    telegramProxyUsername: '',
    telegramProxyPassword: ''
  });
}

for (const path of ['/v1/responses', '/v1/images/generations'] as const) {
  test(`${path} sends the OpenAI hostname to the configured SOCKS proxy`, async (t) => {
    let destination: { host: string; port: number } | undefined;
    await withProxy(t, (socket) => {
      let greeting = true;
      let buffered = Buffer.alloc(0);
      socket.on('data', (chunk: Buffer) => {
        buffered = Buffer.concat([buffered, chunk]);
        if (greeting) {
          if (buffered.length < 2 || buffered.length < 2 + buffered[1]) return;
          assert.equal(buffered[0], 5);
          buffered = buffered.subarray(2 + buffered[1]);
          greeting = false;
          socket.write(Buffer.from([5, 0]));
        }
        if (buffered.length < 5) return;
        assert.equal(buffered[3], 3, 'DNS must be resolved by the proxy');
        const length = buffered[4];
        if (buffered.length < 7 + length) return;
        destination = { host: buffered.toString('utf8', 5, 5 + length), port: buffered.readUInt16BE(5 + length) };
        // Отказ прокси завершает проверку до TLS и платного запроса к OpenAI.
        socket.end(Buffer.from([5, 1, 0, 1, 0, 0, 0, 0, 0, 0]));
      });
    });
    await assert.rejects(requestOpenAi(path, 'test-key', { model: 'test' }, 2_000), /Socks5 proxy rejected/);
    assert.deepEqual(destination, { host: 'api.openai.com', port: 443 });
  });
}

test('OpenAI request times out while the SOCKS proxy is silent', async (t) => {
  await withProxy(t, () => undefined);
  const started = Date.now();
  await assert.rejects(requestOpenAi('/v1/responses', 'test-key', {}, 100), /abort|timed out/i);
  assert.ok(Date.now() - started < 2_000);
});

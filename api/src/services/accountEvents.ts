import type { Response } from 'express';

const connectionsByUserId = new Map<string, Set<Response>>();

function removeConnection(userId: string, response: Response) {
  const connections = connectionsByUserId.get(userId);

  if (!connections) {
    return;
  }

  connections.delete(response);

  if (connections.size === 0) {
    connectionsByUserId.delete(userId);
  }
}

export function subscribeToAccountEvents(userId: string, response: Response) {
  response.status(200);
  response.set({
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'Content-Type': 'text/event-stream',
    'X-Accel-Buffering': 'no'
  });
  response.flushHeaders();
  response.write('retry: 5000\n\n');

  const connections = connectionsByUserId.get(userId) ?? new Set<Response>();
  connections.add(response);
  connectionsByUserId.set(userId, connections);

  const heartbeat = setInterval(() => response.write(': keep-alive\n\n'), 25_000);
  response.on('close', () => {
    clearInterval(heartbeat);
    removeConnection(userId, response);
  });
}

export function publishAccountUpdated(userId: string) {
  const connections = connectionsByUserId.get(userId);

  if (!connections) {
    return;
  }

  for (const response of connections) {
    response.write('event: account-updated\ndata: {}\n\n');
  }
}

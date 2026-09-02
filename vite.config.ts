import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';

const landingFile = resolve('public/landing.html');
const legacyAssetsDirectory = resolve('legacy/local/templates/site');
const contentTypes: Record<string, string> = {
  '.css': 'text/css',
  '.gif': 'image/gif',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
};

function landingDevServer() {
  return {
    name: 'landing-dev-server',
    configureServer(server: { middlewares: { use: (handler: (req: { url?: string }, res: { setHeader: (name: string, value: string) => void; end: (body?: string | Buffer) => void }, next: () => void) => void) => void } }) {
      server.middlewares.use((req, res, next) => {
        const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;

        if (pathname === '/') {
          void readFile(landingFile, 'utf8').then((content) => {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.end(content);
          });
          return;
        }

        if (!pathname.startsWith('/legacy-site/')) {
          next();
          return;
        }

        const assetPath = resolve(legacyAssetsDirectory, pathname.slice('/legacy-site/'.length));
        if (!assetPath.startsWith(`${legacyAssetsDirectory}/`)) {
          next();
          return;
        }

        void readFile(assetPath).then((content) => {
          res.setHeader('Content-Type', contentTypes[extname(assetPath).toLowerCase()] ?? 'application/octet-stream');
          res.end(content);
        }).catch(next);
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), landingDevServer()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4000',
      '/controllers': 'http://localhost:4000'
    }
  }
});

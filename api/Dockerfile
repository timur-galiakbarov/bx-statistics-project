FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY api/package.json api/package.json
RUN npm ci --workspace @socstat/api --include-workspace-root

COPY api ./api
RUN npm run build --workspace @socstat/api

ENV NODE_ENV=production

EXPOSE 4000

CMD ["node", "api/dist/server.js"]

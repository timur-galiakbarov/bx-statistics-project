FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY api/package.json api/package.json
RUN npm ci

COPY index.html tsconfig.json tsconfig.node.json vite.config.ts ./
COPY src ./src
COPY public ./public
COPY legacy/local/templates/site ./legacy-site
RUN npm run build:frontend

FROM nginx:1.27-alpine

COPY deploy/nginx/app.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
COPY --from=build /app/legacy-site /usr/share/nginx/html/legacy-site

EXPOSE 80

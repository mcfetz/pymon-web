## ── Stage 1: Build ───────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build


## ── Stage 2: Serve ───────────────────────────────────────────────────────
FROM nginx:1.27-alpine

# nginx config template (backend URL injected at runtime via envsubst)
COPY nginx.conf.template /etc/nginx/templates/nginx.conf.template

# Built static assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Entrypoint: run envsubst, then start nginx
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/docker-entrypoint.sh"]

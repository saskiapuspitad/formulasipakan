# =============================================================================
# Sistem Formulasi Pakan — image aplikasi (web PWA + API dalam satu kontainer)
# Dibangun di VPS oleh deploy/docker/pasang-docker.sh
# =============================================================================

# 1) Build aplikasi web (PWA)
FROM node:22-alpine AS web
WORKDIR /build/web
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund --loglevel=error
COPY web/ ./
RUN npm run build

# 2) Pustaka server (tanpa paket pengembangan)
FROM node:22-alpine AS server-deps
WORKDIR /app
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund --loglevel=error

# 3) Image akhir
FROM node:22-alpine
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    STATIC_DIR=/app/public
WORKDIR /app
COPY --from=server-deps /app/node_modules ./node_modules
COPY server/package.json ./
COPY server/src ./src
COPY server/scripts ./scripts
COPY server/migrations ./migrations
COPY server/data ./data
COPY --from=web /build/web/dist ./public
USER node
EXPOSE 3000
# Sehat = API menjawab DAN yang menjawab memang aplikasi ini
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/sehat').then(r=>r.json()).then(j=>process.exit(j.aplikasi==='formulasipakan'?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/index.js"]

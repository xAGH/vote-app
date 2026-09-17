# syntax=docker/dockerfile:1

# ---- deps: instala dependencias con el toolchain nativo disponible ----
# better-sqlite3 trae binarios prebuilt para linux/glibc en la mayoría de
# casos, pero conservamos python3/make/g++ en esta etapa para que la
# compilación desde código fuente funcione igual si no hay un prebuild para
# la arquitectura del host (p. ej. un host arm64 sin match exacto).
FROM node:20-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---- runtime: imagen final, sin toolchain de compilación ----
FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

RUN groupadd --system --gid 1001 showroom \
    && useradd --system --uid 1001 --gid showroom showroom

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src

# La base de datos SQLite vive en /app/data — se monta como volumen para
# que sobreviva a un `docker compose up --build` o a un redeploy.
RUN mkdir -p /app/data && chown -R showroom:showroom /app/data /app

USER showroom

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/server.js"]

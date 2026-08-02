# DWdigitalInvite - Production Dockerfile
# Build: oven/bun (glibc) | Runner: node:22-alpine (musl)

# ── Build stage ──────────────────────────────────────────────────────────────
FROM oven/bun:1 AS builder
WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

COPY . .

# Patch Prisma provider for Railway Postgres (local dev uses sqlite)
RUN sed -i 's/provider = "sqlite"/provider = "postgresql"/' prisma/schema.prisma

# Generate Prisma client (binaryTargets set in schema for cross-arch engines)
RUN bunx prisma generate

RUN bun run build

# Validate standalone output exists in the builder
RUN test -f ".next/standalone/server.js" || (echo "ERROR: .next/standalone/server.js not generated" && exit 1)

# ── Pre-compile seed scripts to plain JavaScript ────────────────────────────
# The runner stage is node:22-alpine (musl). tsx/esbuild only ship a glibc-linked
# binary (@esbuild/linux-x64) — there is NO musl variant — so `tsx` cannot run
# on Alpine regardless of whether it is re-installed via npm. The previous fix
# (RUN npm install tsx esbuild --no-save) re-installed the SAME glibc binary and
# therefore still failed at runtime.
#
# Fix: compile each seed .ts to a self-contained ES module (.mjs) HERE in the
# builder (where esbuild's glibc binary works), keeping @prisma/client +
# bcryptjs as EXTERNAL imports (resolved from node_modules at runtime, so the
# Prisma query-engine binary selection — incl. the linux-musl variant from
# binaryTargets — is untouched). The runner then executes them with plain
# `node` — no tsx, no esbuild, no transpiler needed at runtime.
RUN ./node_modules/.bin/esbuild prisma/seed.ts \
      --bundle --platform=node --format=esm --packages=external \
      --outfile=dist/seed.mjs \
 && ./node_modules/.bin/esbuild scripts/seed-roles.ts \
      --bundle --platform=node --format=esm --packages=external \
      --outfile=dist/seed-roles.mjs \
 && ./node_modules/.bin/esbuild scripts/seed-content-templates.ts \
      --bundle --platform=node --format=esm --packages=external \
      --outfile=dist/seed-content-templates.mjs \
 && test -s dist/seed.mjs \
 && test -s dist/seed-roles.mjs \
 && test -s dist/seed-content-templates.mjs

# ── Production runner ────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# NOTE: NEXTAUTH_SECRET, NEXTAUTH_URL, DATABASE_URL are injected
# by the hosting platform (Railway). No hardcoded fallbacks.

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Preserve the .next/standalone/ directory tree intact.
# server.js remains at /app/.next/standalone/server.js.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./.next/standalone

# Verify the entrypoint resolved correctly before proceeding
RUN test -f ".next/standalone/server.js" || (echo "FATAL: .next/standalone/server.js missing after COPY" && exit 1)

# Static assets — the standalone server resolves these from
# __dirname/.next/static  (i.e. .next/standalone/.next/static)
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/standalone/.next/static

# Public directory — resolved from __dirname/public
COPY --from=builder --chown=nextjs:nodejs /app/public ./.next/standalone/public

# Prisma schema + CLI for runtime db push + client libs for seed scripts
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts

# Copy package.json (needed for prisma db seed command + local dev parity)
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json

# Pre-compiled seed scripts (plain .mjs — run with `node`, no tsx at runtime)
COPY --from=builder --chown=nextjs:nodejs /app/dist ./dist

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Run db push (create/migrate schema) → seed all data → start server.
# All seed scripts are idempotent (use upsert), safe to run on every deploy.
# Order matters: seed.mjs creates the wedding → seed-roles.mjs creates
# permissions → seed-content-templates.mjs creates template from wedding.
# Seeds are pre-compiled .mjs files executed with plain `node`, so no
# tsx/esbuild runtime dependency is required on Alpine (musl). Each script
# exits 0 only on success, so a real seed failure stops the chain and the
# server does NOT start with an empty database.
CMD ["sh", "-c", "./node_modules/.bin/prisma db push && node dist/seed.mjs && node dist/seed-roles.mjs && node dist/seed-content-templates.mjs && node .next/standalone/server.js"]

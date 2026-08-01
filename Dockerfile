# DWdigitalInvite - Production Dockerfile
# Build: oven/bun | Runner: node:22-alpine

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

# Prisma schema + CLI for runtime db push + seed
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts

# Copy package.json (needed for prisma db seed command)
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json

# Reinstall tsx + esbuild for musl (Alpine) — the builder's glibc binaries won't work here
RUN npm install tsx esbuild --no-save

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Run db push (create/migrate schema) → seed all data → start server
# All seed scripts are idempotent (use upsert), safe to run on every deploy
# Order matters: seed.ts creates the wedding → seed-roles creates permissions → seed-content-templates creates template from wedding
# NOTE: We call tsx directly (not 'prisma db seed') because prisma can't find tsx in PATH on Alpine
# NOTE: tsx + esbuild are installed in the runner stage to get musl-compatible binaries (builder uses glibc)
CMD ["sh", "-c", "./node_modules/.bin/prisma db push && ./node_modules/.bin/tsx prisma/seed.ts && ./node_modules/.bin/tsx scripts/seed-roles.ts && ./node_modules/.bin/tsx scripts/seed-content-templates.ts && node .next/standalone/server.js"]
# Dockerfile
#
# Railpack ignores the `build_cmd` in railpack-plan.json for this project and
# falls back to its hardcoded `npm run build` step, which fails because this
# project uses Bun (there is no npm lockfile and no npm binary requirement).
#
# This Dockerfile bypasses Railpack entirely and takes full control of the
# build and runtime so the correct package manager (Bun) is always used.

FROM node:20-bookworm-slim

# --- System deps -------------------------------------------------------
# curl/ca-certificates/unzip are required to install Bun.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl unzip \
    && rm -rf /var/lib/apt/lists/*

# --- Install Bun ---------------------------------------------------------
RUN curl -fsSL https://bun.sh/install | bash
ENV BUN_INSTALL="/root/.bun"
ENV PATH="${BUN_INSTALL}/bin:${PATH}"

WORKDIR /app

# --- Install dependencies with Bun --------------------------------------
# Copy only the manifest + lockfile first so this layer is cached unless
# dependencies change.
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# --- Copy the rest of the source ----------------------------------------
COPY . .

# --- Generate Prisma client ----------------------------------------------
RUN bunx prisma generate

# --- Build the Next.js app with Bun --------------------------------------
ENV NODE_ENV=production
RUN bun run build

# --- Verify the standalone output was produced ---------------------------
RUN if [ ! -f ".next/standalone/server.js" ]; then \
      echo "ERROR: .next/standalone/server.js was not generated. Check next.config.ts (output: 'standalone') and the build output above." >&2; \
      exit 1; \
    fi

# Standalone builds don't automatically bundle static assets/public files -
# copy them alongside server.js so they're served correctly at runtime.
RUN mkdir -p .next/standalone/.next/static \
    && cp -r .next/static/. .next/standalone/.next/static/ \
    && mkdir -p .next/standalone/public \
    && cp -r public/. .next/standalone/public/

ENV PORT=3000
EXPOSE 3000

CMD ["node", ".next/standalone/server.js"]

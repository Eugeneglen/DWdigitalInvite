# Explicit Dockerfile to bypass Railpack's build output suppression.
# This gives us full visibility into `next build` so we can diagnose why
# `.next/standalone/server.js` is not being produced.

FROM node:22.23.1

WORKDIR /app

# Install bun (used to run the app at start, matching the previous start command)
RUN npm install -g bun

# Install dependencies first for better layer caching
COPY package.json bun.lock* package-lock.json* ./
COPY prisma ./prisma

RUN npm install

# Generate the Prisma client
RUN npx prisma generate

# Copy the rest of the source
COPY . .

# Railway provides DATABASE_URL as a build-time secret/environment variable.
# Accept it here so Prisma uses Railway's actual database instead of any
# local .env value (which is excluded from the image via .dockerignore).
ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL}

# Run the build with full, unsuppressed output so we can see exactly
# what next build is doing (and whether it errors out).
RUN npm run build

# Seed the database using Railway's DATABASE_URL so the user table is
# populated for login to work.
RUN npx prisma db seed

ENV NODE_ENV=production
EXPOSE 3000

CMD ["bun", ".next/standalone/server.js"]

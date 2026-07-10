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

# Run the build with full, unsuppressed output so we can see exactly
# what next build is doing (and whether it errors out).
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

CMD ["bun", ".next/standalone/server.js"]

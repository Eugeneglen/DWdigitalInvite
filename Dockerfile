# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY bun.lock ./

# Install dependencies
RUN npm ci

# Copy Prisma schema and generate client
COPY prisma ./prisma
RUN npx prisma generate

# Copy entire project
COPY . .

# Build Next.js with standalone output
RUN npm run build

# Verify standalone output was created
RUN if [ ! -d ".next/standalone" ]; then echo "ERROR: .next/standalone not created!"; exit 1; fi
RUN echo "SUCCESS: .next/standalone directory created"

# Runtime stage
FROM node:22-alpine

WORKDIR /app

# Copy only what's needed from build
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Create startup script that seeds database before starting app
RUN echo '#!/bin/sh\necho "Seeding database..."\nnpx prisma db push --skip-generate\nnode prisma/seed.ts\necho "Starting application..."\nnode server.js' > /app/startup.sh
RUN chmod +x /app/startup.sh

CMD ["/app/startup.sh"]

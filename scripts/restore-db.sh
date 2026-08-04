#!/usr/bin/env bash
# One-command database restore — runs both seed scripts in sequence
# Usage: bash scripts/restore-db.sh
set -e
cd "$(dirname "$0")/.."
echo "🔄 Restoring database..."
bunx tsx prisma/seed.ts
echo ""
bunx tsx scripts/seed-content-templates.ts
echo ""
echo "✅ Database restored. You can log in now."

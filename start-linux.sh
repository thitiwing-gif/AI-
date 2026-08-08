#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
[ -f .env ] || cp .env.example .env
set -a; [ -f .env ] && . ./.env; set +a
echo "AI Creator Studio V2 → http://localhost:${PORT:-3847}"
cd backend && node server-lite.js
